FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY PromptProcessor.sln .
COPY backend/src/PromptProcessor.Domain/PromptProcessor.Domain.csproj backend/src/PromptProcessor.Domain/
COPY backend/src/PromptProcessor.Infrastructure/PromptProcessor.Infrastructure.csproj backend/src/PromptProcessor.Infrastructure/
COPY backend/src/PromptProcessor.Api/PromptProcessor.Api.csproj backend/src/PromptProcessor.Api/
RUN dotnet restore backend/src/PromptProcessor.Api/PromptProcessor.Api.csproj

COPY backend/src backend/src
RUN dotnet publish backend/src/PromptProcessor.Api/PromptProcessor.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENTRYPOINT ["dotnet", "PromptProcessor.Api.dll"]
