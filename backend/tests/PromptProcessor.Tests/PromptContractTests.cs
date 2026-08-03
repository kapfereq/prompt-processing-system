using System.ComponentModel.DataAnnotations;
using System.Reflection;
using PromptProcessor.Api.Contracts;

namespace PromptProcessor.Tests;

public sealed class PromptContractTests
{
    [Fact]
    public void Validation_attributes_are_attached_to_record_constructor_parameters()
    {
        var batchParameter = ConstructorParameter<CreatePromptsRequest>();
        Assert.NotNull(batchParameter.GetCustomAttribute<RequiredAttribute>());
        Assert.NotNull(batchParameter.GetCustomAttribute<MinLengthAttribute>());
        Assert.NotNull(batchParameter.GetCustomAttribute<MaxLengthAttribute>());

        var promptParameter = ConstructorParameter<CreatePromptRequest>();
        Assert.NotNull(promptParameter.GetCustomAttribute<RequiredAttribute>());
        Assert.NotNull(promptParameter.GetCustomAttribute<StringLengthAttribute>());
    }

    private static ParameterInfo ConstructorParameter<T>() =>
        typeof(T).GetConstructors().Single().GetParameters().Single();
}
