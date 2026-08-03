using OpenAI.Chat;

namespace PromptProcessor.Worker;

internal interface ILanguageModelClient
{
    Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken);
}

internal sealed class OpenAiLanguageModelClient : ILanguageModelClient
{
    private readonly ChatClient _client;

    public OpenAiLanguageModelClient(LlmOptions options)
    {
        _client = new ChatClient(options.Model, options.ApiKey!);
    }

    public async Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken)
    {
        ChatCompletion completion = await _client.CompleteChatAsync(
            [new UserChatMessage(prompt)],
            options: null,
            cancellationToken: cancellationToken);

        var text = string.Concat(completion.Content.Select(part => part.Text)).Trim();
        return string.IsNullOrWhiteSpace(text)
            ? throw new InvalidOperationException("The language model returned no text.")
            : text;
    }
}

internal sealed class FakeLanguageModelClient : ILanguageModelClient
{
    public Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult($"Demo response: {prompt.Trim()}");
    }
}

internal sealed class LlmOptions
{
    public const string SectionName = "Llm";

    public string Provider { get; set; } = "OpenAI";
    public string? ApiKey { get; set; }
    public string Model { get; set; } = "gpt-5-mini";
    public int TimeoutSeconds { get; set; } = 60;
}
