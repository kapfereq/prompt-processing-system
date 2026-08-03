using MassTransit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromptProcessor.Api.Contracts;
using PromptProcessor.Domain;
using PromptProcessor.Infrastructure;

namespace PromptProcessor.Api.Controllers;

[ApiController]
[Route("api/prompts")]
public sealed class PromptsController(PromptDbContext db, IPublishEndpoint publisher) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType<PromptDto[]>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<PromptDto[]>> Create(
        CreatePromptsRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Prompts.Any(prompt => prompt is null || string.IsNullOrWhiteSpace(prompt.Content)))
        {
            ModelState.AddModelError("prompts", "Each prompt must contain text.");
            return ValidationProblem(ModelState);
        }

        var jobs = request.Prompts.Select(prompt => new PromptJob(prompt.Content)).ToArray();

        db.PromptJobs.AddRange(jobs);
        foreach (var job in jobs)
        {
            await publisher.Publish(new ProcessPrompt(job.Id), cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);

        return Accepted(jobs.Select(PromptDto.From).ToArray());
    }

    [HttpGet]
    [ProducesResponseType<PromptDto[]>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PromptDto[]>> GetAll(CancellationToken cancellationToken)
    {
        var prompts = await db.PromptJobs
            .AsNoTracking()
            .OrderByDescending(job => job.CreatedAt)
            .Select(job => new PromptDto(
                job.Id,
                job.Content,
                job.Status,
                job.Result,
                job.ErrorMessage,
                job.CreatedAt,
                job.StartedAt,
                job.CompletedAt))
            .ToArrayAsync(cancellationToken);

        return Ok(prompts);
    }
}
