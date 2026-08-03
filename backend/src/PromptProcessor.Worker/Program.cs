using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PromptProcessor.Infrastructure;
using PromptProcessor.Worker;

var builder = Host.CreateApplicationBuilder(args);

if (string.IsNullOrWhiteSpace(builder.Configuration["Llm:ApiKey"]))
{
    builder.Configuration["Llm:ApiKey"] = builder.Configuration["OPENAI_API_KEY"];
}

builder.Services
    .AddOptions<LlmOptions>()
    .Bind(builder.Configuration.GetSection(LlmOptions.SectionName))
    .Validate(options =>
        options.Provider.Equals("OpenAI", StringComparison.OrdinalIgnoreCase) ||
        options.Provider.Equals("Fake", StringComparison.OrdinalIgnoreCase),
        "Llm:Provider must be OpenAI or Fake.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.Model), "Llm:Model is required.")
    .Validate(options => options.TimeoutSeconds is > 0 and <= 600,
        "Llm:TimeoutSeconds must be between 1 and 600.")
    .Validate(options =>
        !options.Provider.Equals("OpenAI", StringComparison.OrdinalIgnoreCase) ||
        !string.IsNullOrWhiteSpace(options.ApiKey),
        "Llm:ApiKey or OPENAI_API_KEY is required for the OpenAI provider.")
    .Validate(options =>
        !options.Provider.Equals("Fake", StringComparison.OrdinalIgnoreCase) ||
        IsNonProductionEnvironment(builder.Environment),
        "The Fake provider is available only in Development, Test, Testing, or Demo.")
    .ValidateOnStart();

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("ConnectionStrings:Postgres is required.");

builder.Services.AddDbContext<PromptDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddSingleton<ILanguageModelClient>(services =>
{
    var options = services.GetRequiredService<IOptions<LlmOptions>>().Value;
    return options.Provider.Equals("Fake", StringComparison.OrdinalIgnoreCase)
        ? new FakeLanguageModelClient()
        : new OpenAiLanguageModelClient(options);
});

var rabbitHost = builder.Configuration["RabbitMq:Host"] ?? "localhost";
var rabbitVirtualHost = builder.Configuration["RabbitMq:VirtualHost"] ?? "/";
var rabbitUsername = builder.Configuration["RabbitMq:Username"] ?? "guest";
var rabbitPassword = builder.Configuration["RabbitMq:Password"] ?? "guest";
var concurrencyLimit = Math.Clamp(
    builder.Configuration.GetValue("RabbitMq:ConcurrencyLimit", 4), 1, 32);

builder.Services.AddMassTransit(bus =>
{
    bus.AddConsumer<ProcessPromptConsumer>();
    bus.UsingRabbitMq((context, rabbit) =>
    {
        rabbit.Host(rabbitHost, rabbitVirtualHost, host =>
        {
            host.Username(rabbitUsername);
            host.Password(rabbitPassword);
        });

        rabbit.ReceiveEndpoint("prompt-processing", endpoint =>
        {
            endpoint.ConcurrentMessageLimit = concurrencyLimit;
            endpoint.ConfigureConsumer<ProcessPromptConsumer>(context);
        });
    });
});

await builder.Build().RunAsync();

static bool IsNonProductionEnvironment(IHostEnvironment environment) =>
    environment.IsDevelopment() ||
    environment.IsEnvironment("Test") ||
    environment.IsEnvironment("Testing") ||
    environment.IsEnvironment("Demo");
