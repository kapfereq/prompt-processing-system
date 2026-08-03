using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PromptProcessor.Domain;
using PromptProcessor.Infrastructure;

namespace PromptProcessor.Worker;

internal sealed class ProcessPromptConsumer(
    PromptDbContext dbContext,
    ILanguageModelClient languageModel,
    IOptions<LlmOptions> options,
    ILogger<ProcessPromptConsumer> logger) : IConsumer<ProcessPrompt>
{
    private const string FailureMessage = "The prompt could not be processed. Please try again.";
    private const string TimeoutMessage = "The language model request timed out. Please try again.";

    public async Task Consume(ConsumeContext<ProcessPrompt> context)
    {
        var cancellationToken = context.CancellationToken;
        var job = await dbContext.PromptJobs.SingleOrDefaultAsync(
            candidate => candidate.Id == context.Message.PromptId,
            cancellationToken);

        if (job is null)
        {
            logger.LogWarning("Prompt job {PromptId} was not found", context.Message.PromptId);
            return;
        }

        if (job.IsTerminal)
        {
            logger.LogInformation("Ignoring duplicate delivery for terminal prompt job {PromptId}", job.Id);
            return;
        }

        if (job.Status == PromptStatus.Pending)
        {
            job.MarkAsProcessing();
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.Value.TimeoutSeconds));

        string result;
        try
        {
            result = await languageModel.CompleteAsync(job.Content, timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Language model request timed out for prompt job {PromptId}", job.Id);
            await FailAsync(job, TimeoutMessage, cancellationToken);
            return;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Language model request failed for prompt job {PromptId}", job.Id);
            await FailAsync(job, FailureMessage, cancellationToken);
            return;
        }

        job.Complete(result);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Completed prompt job {PromptId}", job.Id);
    }

    private async Task FailAsync(PromptJob job, string message, CancellationToken cancellationToken)
    {
        job.Fail(message);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
