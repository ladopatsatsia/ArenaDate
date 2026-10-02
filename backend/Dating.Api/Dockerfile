FROM mcr.microsoft.com/dotnet/sdk:10.0.401 AS build
WORKDIR /src
COPY global.json ./
COPY backend/ backend/
RUN dotnet restore backend/Dating.Api/Dating.Api.csproj --locked-mode
RUN dotnet publish backend/Dating.Api/Dating.Api.csproj -c Release --no-restore -o /app
FROM build AS image-check
RUN dotnet test backend/tests/Dating.UnitTests/Dating.UnitTests.csproj --filter FullyQualifiedName~PhotoProcessorTests
FROM mcr.microsoft.com/dotnet/aspnet:10.0.12 AS runtime
WORKDIR /app
COPY --from=build /app ./
RUN mkdir -p /app/auth-keyring /app/private-media && chown $APP_UID:$APP_UID /app/auth-keyring /app/private-media
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Dating.Api.dll"]
