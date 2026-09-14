namespace LabelVihitha.Application.Features.SubCategories;

public interface ISubCategoryService
{
    Task<IReadOnlyList<SubCategoryDto>> GetAsync(int? categoryId, bool includeInactive, CancellationToken ct = default);
    Task<SubCategoryDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<SubCategoryDto> CreateAsync(CreateSubCategoryRequest request, CancellationToken ct = default);
    Task<SubCategoryDto> UpdateAsync(int id, UpdateSubCategoryRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
