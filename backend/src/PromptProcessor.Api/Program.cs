using System.Text.Json.Serialization;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using PromptProcessor.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var rabbitMq = builder.Configuration.GetSection("RabbitMq");

builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddDbContext<PromptDbContext>(options => options.UseNpgsql(
    builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("ConnectionStrings:Postgres is required."),
    postgres => postgres.EnableRetryOnFailure(3)));
builder.Services.AddMassTransit(bus =>
{
    bus.AddEntityFrameworkOutbox<PromptDbContext>(outbox =>
    {
        outbox.UsePostgres();
        outbox.UseBusOutbox();
        outbox.DisableInboxCleanupService();
        outbox.QueryDelay = TimeSpan.FromSeconds(1);
    });

    bus.UsingRabbitMq((context, rabbit) =>
    {
        rabbit.Host(rabbitMq["Host"] ?? "rabbitmq", rabbitMq["VirtualHost"] ?? "/", host =>
        {
            host.Username(rabbitMq["Username"] ?? "guest");
            host.Password(rabbitMq["Password"] ?? "guest");
        });
    });
});

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<PromptDbContext>().Database.MigrateAsync();
}

app.UseCors("Frontend");
app.MapOpenApi();
app.MapGet("/health", async (PromptDbContext db, CancellationToken cancellationToken) =>
    await db.Database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "healthy" })
        : Results.Problem("Database is unavailable.", statusCode: StatusCodes.Status503ServiceUnavailable));
app.MapControllers();

await app.RunAsync();
