namespace LabelVihitha.Application.Features.Finance;

public interface IFinanceService
{
    Task<ProfitLossReport> GetProfitAndLossAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
}
