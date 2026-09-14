using System.Text.Json;
using FluentValidation;
using LabelVihitha.Application.Common.Exceptions;

namespace LabelVihitha.Api.Infrastructure;

/// <summary>Maps application exceptions to RFC7807-ish JSON problem responses.</summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception ex)
    {
        var (status, title, errors) = ex switch
        {
            ValidationException v => (
                StatusCodes.Status400BadRequest,
                "Validation failed",
                v.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())),
            NotFoundException => (StatusCodes.Status404NotFound, ex.Message, null),
            ConflictException => (StatusCodes.Status409Conflict, ex.Message, null),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, ex.Message, null),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null)
        };

        if (status == StatusCodes.Status500InternalServerError)
            _logger.LogError(ex, "Unhandled exception");

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";

        var payload = new Dictionary<string, object?>
        {
            ["status"] = status,
            ["title"] = title
        };
        if (errors is not null)
            payload["errors"] = errors;

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }
}
