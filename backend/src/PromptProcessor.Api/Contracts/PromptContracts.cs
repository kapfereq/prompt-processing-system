using System.ComponentModel.DataAnnotations;
using PromptProcessor.Domain;

namespace PromptProcessor.Api.Contracts;

public sealed record CreatePromptsRequest(
    [property: Required, MinLength(1), MaxLength(20)] CreatePromptRequest[] Prompts);

public sealed record CreatePromptRequest(
    [property: Required, StringLength(4_000, MinimumLength = 1)] string Content);

public sealed record PromptDto(
    Guid Id,
    string Content,
    PromptStatus Status,
    string? Result,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt)
{
    public static PromptDto From(PromptJob job) => new(
        job.Id,
        job.Content,
        job.Status,
        job.Result,
        job.ErrorMessage,
        job.CreatedAt,
        job.StartedAt,
        job.CompletedAt);
}
