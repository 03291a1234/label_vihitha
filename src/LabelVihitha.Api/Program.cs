using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using LabelVihitha.Api.Infrastructure;
using LabelVihitha.Application;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Infrastructure;
using LabelVihitha.Infrastructure.Auth;
using LabelVihitha.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicy = "WebApp";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:4200" };

builder.Services.AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<LabelVihitha.Application.Common.CurrencySettings>(
    builder.Configuration.GetSection(LabelVihitha.Application.Common.CurrencySettings.SectionName));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// --- Authentication (JWT) ---
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? new JwtSettings();
// Fail fast rather than boot with an insecure signing key outside local dev. Supply a strong
// secret via the environment variable Jwt__Key (or a secrets store) in staging/production.
if (!builder.Environment.IsDevelopment() &&
    (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Contains("CHANGE_ME") || Encoding.UTF8.GetByteCount(jwt.Key) < 32))
{
    throw new InvalidOperationException(
        "Jwt:Key must be a strong secret of at least 32 bytes outside Development. " +
        "Set it via the Jwt__Key environment variable or a secrets store — never the shipped default.");
}
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key))
        };
    });
builder.Services.AddAuthorization();

// --- Rate limiting: protect the public (anonymous) storefront endpoints from abuse ---
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("public", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 20;
        opt.QueueLimit = 0;
    });
});

builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy =>
{
    // "*" opens CORS to any origin (auth is Bearer-token, not cookie-based, so this is
    // safe) — used for temporary public tunnels; otherwise restrict to the configured list.
    if (allowedOrigins.Contains("*"))
        policy.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod();
    else
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

// --- Swagger with Bearer auth ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Label_Vihitha API", Version = "v1" });
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    c.AddSecurityDefinition("Bearer", scheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = Array.Empty<string>() });
});

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles(); // serves wwwroot (uploaded product photos under /uploads)
app.UseCors(CorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
// Serve the built Angular SPA for any non-API route (single App Service hosts API + web,
// same-origin). Harmless in dev where wwwroot has no index.html (returns 404, web runs separately).
app.MapFallbackToFile("index.html");

// Apply migrations + seed on startup (skippable for pure design-time / test scenarios).
if (builder.Configuration.GetValue("Seed:OnStartup", true))
{
    await DbSeeder.SeedAsync(app.Services);
}

app.Run();

public partial class Program { } // exposed for integration testing
