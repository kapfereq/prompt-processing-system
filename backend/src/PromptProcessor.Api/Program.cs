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
    ?? throw new InvalidOperationException("ConnectionStrings:Postgres is required.")));
builder.Services.AddMassTransit(bus => bus.UsingRabbitMq((context, rabbit) =>
{
    rabbit.Host(rabbitMq["Host"] ?? "rabbitmq", rabbitMq["VirtualHost"] ?? "/", host =>
    {
        host.Username(rabbitMq["Username"] ?? "guest");
        host.Password(rabbitMq["Password"] ?? "guest");
    });
}));

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<PromptDbContext>().Database.MigrateAsync();
}

app.UseCors("Frontend");
app.MapOpenApi();
app.MapControllers();

await app.RunAsync();
