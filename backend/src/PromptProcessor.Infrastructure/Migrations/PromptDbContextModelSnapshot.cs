using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using PromptProcessor.Domain;

#nullable disable

namespace PromptProcessor.Infrastructure.Migrations;

[DbContext(typeof(PromptDbContext))]
partial class PromptDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "10.0.10")
            .HasAnnotation("Relational:MaxIdentifierLength", 63)
            .HasAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

        modelBuilder.Entity<PromptJob>(entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            entity.Property<DateTimeOffset?>("CompletedAt").HasColumnType("timestamp with time zone");
            entity.Property<string>("Content").IsRequired().HasMaxLength(4000).HasColumnType("character varying(4000)");
            entity.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            entity.Property<string>("ErrorMessage").HasMaxLength(4000).HasColumnType("character varying(4000)");
            entity.Property<string>("Result").HasColumnType("text");
            entity.Property<DateTimeOffset?>("StartedAt").HasColumnType("timestamp with time zone");
            entity.Property<PromptStatus>("Status")
                .HasMaxLength(20)
                .HasColumnType("character varying(20)")
                .HasConversion<string>();

            entity.HasKey("Id");
            entity.HasIndex("CreatedAt");
            entity.ToTable("prompt_jobs");
        });
    }
}
