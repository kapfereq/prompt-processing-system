namespace PromptProcessor.Domain;

public sealed class PromptJob
{
    private PromptJob() { }

    public PromptJob(string content)
    {
        if (string.IsNullOrWhiteSpace(content) || content.Length > 4_000)
        {
            throw new ArgumentException("Content must contain between 1 and 4000 characters.", nameof(content));
        }

        Id = Guid.NewGuid();
        Content = content;
        Status = PromptStatus.Pending;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public string Content { get; private set; } = null!;
    public PromptStatus Status { get; private set; }
    public string? Result { get; private set; }
    public string? ErrorMessage { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public bool IsTerminal => Status is PromptStatus.Completed or PromptStatus.Failed;

    public void MarkAsProcessing()
    {
        EnsureStatus(PromptStatus.Pending);
        Status = PromptStatus.Processing;
        StartedAt = DateTimeOffset.UtcNow;
    }

    public void Complete(string result)
    {
        ArgumentNullException.ThrowIfNull(result);
        EnsureStatus(PromptStatus.Processing);
        Status = PromptStatus.Completed;
        Result = result;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Fail(string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(errorMessage))
        {
            throw new ArgumentException("An error message is required.", nameof(errorMessage));
        }

        EnsureStatus(PromptStatus.Processing);
        Status = PromptStatus.Failed;
        ErrorMessage = errorMessage;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    private void EnsureStatus(PromptStatus expected)
    {
        if (Status != expected)
        {
            throw new InvalidOperationException($"Cannot transition a prompt from {Status}; expected {expected}.");
        }
    }
}
