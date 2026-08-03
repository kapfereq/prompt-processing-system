using MassTransit;
using MassTransit.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PromptProcessor.Domain;
using PromptProcessor.Infrastructure;
using PromptProcessor.Worker;

namespace PromptProcessor.Tests;

public sealed class ProcessPromptConsumerTests
{
    [Fact]
    public async Task Consumer_completes_a_pending_job()
    {
        await using var fixture = await ConsumerFixture.StartAsync();
        var job = new PromptJob("  Hello model  ");
        await fixture.SaveAsync(job);

        await fixture.SendAsync(job.Id);

        var saved = await fixture.LoadAsync(job.Id);
        Assert.Equal(PromptStatus.Completed, saved.Status);
        Assert.Equal("Demo response: Hello model", saved.Result);
        Assert.Null(saved.ErrorMessage);
        Assert.True(saved.IsTerminal);
    }

    [Fact]
    public async Task Consumer_ignores_a_terminal_duplicate()
    {
        await using var fixture = await ConsumerFixture.StartAsync();
        var job = new PromptJob("Question");
        job.MarkAsProcessing();
        job.Complete("Original answer");
        var completedAt = job.CompletedAt;
        await fixture.SaveAsync(job);

        await fixture.SendAsync(job.Id);

        var saved = await fixture.LoadAsync(job.Id);
        Assert.Equal(PromptStatus.Completed, saved.Status);
        Assert.Equal("Original answer", saved.Result);
        Assert.Equal(completedAt, saved.CompletedAt);
    }

    [Fact]
    public async Task Consumer_marks_a_job_as_failed_when_the_model_throws()
    {
        await using var fixture = await ConsumerFixture.StartAsync(failModelCall: true);
        var job = new PromptJob("Question");
        await fixture.SaveAsync(job);

        await fixture.SendAsync(job.Id);

        var saved = await fixture.LoadAsync(job.Id);
        Assert.Equal(PromptStatus.Failed, saved.Status);
        Assert.Equal("The prompt could not be processed. Please try again.", saved.ErrorMessage);
        Assert.Null(saved.Result);
        Assert.True(saved.IsTerminal);
    }

    private sealed class ConsumerFixture(ServiceProvider services, ITestHarness harness) : IAsyncDisposable
    {
        public static async Task<ConsumerFixture> StartAsync(bool failModelCall = false)
        {
            var databaseName = Guid.NewGuid().ToString();
            var serviceCollection = new ServiceCollection();
            serviceCollection.AddLogging();
            serviceCollection.AddDbContext<PromptDbContext>(options =>
                options.UseInMemoryDatabase(databaseName));
            serviceCollection.AddSingleton<ILanguageModelClient>(
                failModelCall ? new FailingLanguageModelClient() : new FakeLanguageModelClient());
            serviceCollection.AddSingleton<IOptions<LlmOptions>>(
                Options.Create(new LlmOptions { TimeoutSeconds = 5 }));
            serviceCollection.AddMassTransitTestHarness(registration =>
            {
                registration.SetTestTimeouts(
                    testTimeout: TimeSpan.FromSeconds(30),
                    testInactivityTimeout: TimeSpan.FromSeconds(10));
                registration.AddConsumer<ProcessPromptConsumer>();
            });

            var services = serviceCollection.BuildServiceProvider(validateScopes: true);

            // Compile the EF model before starting MassTransit's inactivity timer.
            // On a cold test process this can otherwise use the whole default timeout.
            await using (var scope = services.CreateAsyncScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<PromptDbContext>();
                await dbContext.Database.EnsureCreatedAsync();
            }

            var harness = services.GetRequiredService<ITestHarness>();
            await harness.Start();
            return new ConsumerFixture(services, harness);
        }

        public async Task SaveAsync(PromptJob job)
        {
            await using var scope = services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<PromptDbContext>();
            dbContext.PromptJobs.Add(job);
            await dbContext.SaveChangesAsync();
        }

        public async Task SendAsync(Guid promptId)
        {
            await harness.Bus.Publish(new ProcessPrompt(promptId));
            var consumer = harness.GetConsumerHarness<ProcessPromptConsumer>();
            Assert.True(await consumer.Consumed.Any<ProcessPrompt>(consumed =>
                consumed.Context.Message.PromptId == promptId));
        }

        public async Task<PromptJob> LoadAsync(Guid promptId)
        {
            await using var scope = services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<PromptDbContext>();
            return await dbContext.PromptJobs.AsNoTracking().SingleAsync(job => job.Id == promptId);
        }

        public async ValueTask DisposeAsync()
        {
            await harness.Stop();
            await services.DisposeAsync();
        }

    }

    private sealed class FailingLanguageModelClient : ILanguageModelClient
    {
        public Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("Provider unavailable");
    }
}
