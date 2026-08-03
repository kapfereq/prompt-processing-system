FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY PromptProcessor.sln .
COPY backend/src/PromptProcessor.Domain/PromptProcessor.Domain.csproj backend/src/PromptProcessor.Domain/
COPY backend/src/PromptProcessor.Infrastructure/PromptProcessor.Infrastructure.csproj backend/src/PromptProcessor.Infrastructure/
COPY backend/src/PromptProcessor.Worker/PromptProcessor.Worker.csproj backend/src/PromptProcessor.Worker/
RUN dotnet restore backend/src/PromptProcessor.Worker/PromptProcessor.Worker.csproj

COPY backend/src backend/src
RUN dotnet publish backend/src/PromptProcessor.Worker/PromptProcessor.Worker.csproj \
    --configuration Release \
    --no-restore \
    --output /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENTRYPOINT ["dotnet", "PromptProcessor.Worker.dll"]
