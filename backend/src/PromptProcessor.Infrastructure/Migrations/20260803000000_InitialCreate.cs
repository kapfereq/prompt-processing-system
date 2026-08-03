using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PromptProcessor.Infrastructure.Migrations;

[DbContext(typeof(PromptDbContext))]
[Migration("20260803000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "prompt_jobs",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Result = table.Column<string>(type: "text", nullable: true),
                ErrorMessage = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_prompt_jobs", job => job.Id));

        migrationBuilder.CreateIndex(
            name: "IX_prompt_jobs_CreatedAt",
            table: "prompt_jobs",
            column: "CreatedAt");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "prompt_jobs");
}
