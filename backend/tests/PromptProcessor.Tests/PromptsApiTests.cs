using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using MassTransit;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PromptProcessor.Api.Contracts;
using PromptProcessor.Api.Controllers;
using PromptProcessor.Infrastructure;

namespace PromptProcessor.Tests;

public sealed class PromptsApiTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public async Task Post_binds_a_valid_request_and_returns_accepted_jobs()
    {
        await using var api = await TestApi.StartAsync();

        var response = await api.Client.PostAsJsonAsync("/api/prompts", new
        {
            prompts = new[] { new { content = "First prompt" }, new { content = "Second prompt" } }
        });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var prompts = await response.Content.ReadFromJsonAsync<PromptDto[]>(JsonOptions);
        Assert.Equal(["First prompt", "Second prompt"], prompts?.Select(prompt => prompt.Content));
    }

    [Fact]
    public async Task Post_rejects_an_empty_batch_through_the_http_pipeline()
    {
        await using var api = await TestApi.StartAsync();

        var response = await api.Client.PostAsJsonAsync("/api/prompts", new { prompts = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed class TestApi(WebApplication app, HttpClient client) : IAsyncDisposable
    {
        public HttpClient Client { get; } = client;

        public static async Task<TestApi> StartAsync()
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                EnvironmentName = "Test"
            });

            builder.WebHost.UseTestServer();
            builder.Services
                .AddControllers()
                .AddApplicationPart(typeof(PromptsController).Assembly)
                .AddJsonOptions(options =>
                    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
            builder.Services.AddDbContext<PromptDbContext>(options =>
                options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
            builder.Services.AddMassTransit(bus => bus.UsingInMemory());

            var app = builder.Build();
            app.MapControllers();
            await app.StartAsync();

            return new TestApi(app, app.GetTestClient());
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }
}
