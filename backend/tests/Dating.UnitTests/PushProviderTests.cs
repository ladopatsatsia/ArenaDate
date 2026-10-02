using System.Net;
using System.Text;
using System.Text.Json;
using Dating.Api.Features.Notifications;
using Microsoft.Extensions.Options;
using Xunit;
namespace Dating.UnitTests;
public class PushProviderTests {
 private sealed class Handler(string response,HttpStatusCode status=HttpStatusCode.OK):HttpMessageHandler{
  public string? Body {get;private set;}public string? Url {get;private set;}public string? Authorization {get;private set;}
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){
   Body=await request.Content!.ReadAsStringAsync(ct);Url=request.RequestUri!.ToString();Authorization=request.Headers.Authorization?.ToString();
   return new(status){Content=new StringContent(response,Encoding.UTF8,"application/json")};
  }
 }
 [Fact]public async Task Provider_uses_fixed_HTTPS_endpoint_generic_payload_and_only_server_notification_ID(){
  var handler=new Handler("""{"data":{"status":"ok","id":"ticket"}}""");var provider=new ExpoPushProvider(new HttpClient(handler),Options.Create(new PushOptions{AccessToken="server-only"}));var id=Guid.NewGuid();
  var result=await provider.Send("ExpoPushToken[test-token]",id,"message",default);Assert.Equal("ticket",result.Status);
  Assert.Equal("https://exp.host/--/api/v2/push/send",handler.Url);Assert.Equal("Bearer server-only",handler.Authorization);
  var payload=JsonDocument.Parse(handler.Body!).RootElement;Assert.Equal("You have a new message.",payload.GetProperty("body").GetString());
  Assert.Equal(id,payload.GetProperty("data").GetProperty("notificationId").GetGuid());Assert.Equal(2,payload.GetProperty("data").EnumerateObject().Count());
 }
 [Theory][InlineData("DeviceNotRegistered","invalid","invalid_token")][InlineData("InvalidCredentials","permanent","provider_credentials")][InlineData("MessageRateExceeded","retry","provider_rate")]
 public async Task Provider_receipt_codes_are_sanitized(string error,string status,string code){
  var handler=new Handler(JsonSerializer.Serialize(new{data=new Dictionary<string,object>{{"ticket",new{status="error",message="sensitive echoed provider token",details=new{error}}}}}));
  var provider=new ExpoPushProvider(new HttpClient(handler),Options.Create(new PushOptions{AccessToken="server-only"}));
  var result=await provider.Receipt("ticket",default);Assert.Equal(status,result.Status);Assert.Equal(code,result.Code);
 }
 [Fact]public void Separate_encryption_key_is_required_when_push_is_enabled(){
  Assert.True(new PushOptions().Valid());Assert.False(new PushOptions{Enabled=true}.Valid());
  var options=new PushOptions{Enabled=true,ProjectId=Guid.NewGuid().ToString(),AccessToken="provider-secret",CurrentKeyId="v1",Keys=new(){{"v1",Convert.ToBase64String(new byte[32])}}};
  Assert.True(options.Valid());var crypto=new PushCrypto(Options.Create(options));var id=Guid.NewGuid();var encrypted=crypto.Seal(id,"sensitive-token");
  var device=new PushDevice{Id=id,KeyId=encrypted.KeyId,Ciphertext=encrypted.Ciphertext};Assert.Equal("sensitive-token",crypto.Open(device));
  device.Id=Guid.NewGuid();Assert.ThrowsAny<System.Security.Cryptography.CryptographicException>(()=>crypto.Open(device));
 }
}
