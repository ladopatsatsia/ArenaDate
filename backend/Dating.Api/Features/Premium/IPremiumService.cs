namespace Dating.Api.Features.Premium;

public interface IPremiumService
{
    PremiumPackageDto[] GetPackages();
    Task<bool> HasActivePremiumAsync(Guid userId, CancellationToken ct = default);
    Task<PremiumStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
    Task<SubscribeResultDto> SubscribeAsync(Guid userId, SubscribePackageRequest request, CancellationToken ct = default);
}
