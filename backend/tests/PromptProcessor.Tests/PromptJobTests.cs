using PromptProcessor.Domain;

namespace PromptProcessor.Tests;

public sealed class PromptJobTests
{
    [Fact]
    public void New_job_is_pending_and_not_terminal()
    {
        var job = new PromptJob("Summarize this text");

        Assert.NotEqual(Guid.Empty, job.Id);
        Assert.Equal("Summarize this text", job.Content);
        Assert.Equal(PromptStatus.Pending, job.Status);
        Assert.False(job.IsTerminal);
        Assert.Null(job.StartedAt);
        Assert.Null(job.CompletedAt);
    }

    [Theory]
    [MemberData(nameof(InvalidContent))]
    public void Constructor_rejects_invalid_content(string? content)
    {
        Assert.Throws<ArgumentException>(() => new PromptJob(content!));
    }

    [Fact]
    public void Constructor_accepts_content_at_the_limit()
    {
        var content = new string('x', 4_000);

        var job = new PromptJob(content);

        Assert.Equal(content, job.Content);
    }

    [Fact]
    public void Job_can_complete_after_processing()
    {
        var job = new PromptJob("Question");

        job.MarkAsProcessing();
        job.Complete("Answer");

        Assert.Equal(PromptStatus.Completed, job.Status);
        Assert.Equal("Answer", job.Result);
        Assert.Null(job.ErrorMessage);
        Assert.NotNull(job.StartedAt);
        Assert.NotNull(job.CompletedAt);
        Assert.True(job.IsTerminal);
    }

    [Fact]
    public void Job_can_fail_after_processing()
    {
        var job = new PromptJob("Question");

        job.MarkAsProcessing();
        job.Fail("Safe failure");

        Assert.Equal(PromptStatus.Failed, job.Status);
        Assert.Equal("Safe failure", job.ErrorMessage);
        Assert.Null(job.Result);
        Assert.True(job.IsTerminal);
    }

    [Fact]
    public void Job_rejects_invalid_state_transitions()
    {
        var pending = new PromptJob("Question");
        Assert.Throws<InvalidOperationException>(() => pending.Complete("Answer"));
        Assert.Throws<InvalidOperationException>(() => pending.Fail("Failure"));

        var completed = new PromptJob("Question");
        completed.MarkAsProcessing();
        completed.Complete("Answer");
        Assert.Throws<InvalidOperationException>(completed.MarkAsProcessing);
    }

    public static TheoryData<string?> InvalidContent => new()
    {
        null,
        string.Empty,
        "   ",
        new string('x', 4_001)
    };
}
