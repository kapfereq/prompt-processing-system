using MassTransit;
using Microsoft.EntityFrameworkCore;
using PromptProcessor.Domain;

namespace PromptProcessor.Infrastructure;

public sealed class PromptDbContext(DbContextOptions<PromptDbContext> options) : DbContext(options)
{
    public DbSet<PromptJob> PromptJobs => Set<PromptJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var prompt = modelBuilder.Entity<PromptJob>();

        prompt.ToTable("prompt_jobs");
        prompt.HasKey(job => job.Id);
        prompt.Property(job => job.Id).ValueGeneratedNever();
        prompt.Property(job => job.Content).HasMaxLength(4_000).IsRequired();
        prompt.Property(job => job.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        prompt.Property(job => job.ErrorMessage).HasMaxLength(4_000);
        prompt.Property<uint>("xmin").IsRowVersion();
        prompt.Ignore(job => job.IsTerminal);
        prompt.HasIndex(job => job.CreatedAt);

        modelBuilder.AddInboxStateEntity(entity => entity.ToTable("inbox_state"));
        modelBuilder.AddOutboxMessageEntity(entity => entity.ToTable("outbox_message"));
        modelBuilder.AddOutboxStateEntity(entity => entity.ToTable("outbox_state"));
    }
}
