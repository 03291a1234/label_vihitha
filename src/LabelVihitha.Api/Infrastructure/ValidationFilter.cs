using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;

namespace LabelVihitha.Api.Infrastructure;

/// <summary>
/// Runs any registered FluentValidation validator against action arguments.
/// Throws ValidationException (handled by the middleware → 400) on failure.
/// </summary>
public class ValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider _services;

    public ValidationFilter(IServiceProvider services) => _services = services;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (_services.GetService(validatorType) is IValidator validator)
            {
                var validationContext = new ValidationContext<object>(argument);
                var result = await validator.ValidateAsync(validationContext, context.HttpContext.RequestAborted);
                if (!result.IsValid)
                    throw new ValidationException(result.Errors);
            }
        }

        await next();
    }
}
