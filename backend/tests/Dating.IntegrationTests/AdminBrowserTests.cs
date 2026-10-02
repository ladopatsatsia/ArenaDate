using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Safety;
using Xunit;
namespace Dating.IntegrationTests;
public sealed class BrowserFactAttribute:FactAttribute { public BrowserFactAttribute(){if(Environment.GetEnvironmentVariable("RUN_ADMIN_BROWSER")!="1")Skip="Opt-in real browser: RUN_ADMIN_BROWSER=1; build Angular and install Playwright first.";} }
public class AdminBrowserTests {
 [BrowserFact] public async Task Real_Angular_browser_moderates_with_MFA_cookie_CSRF_and_PostgreSQL() {
  using var rsa=RSA.Create(2048);var request=new CertificateRequest("CN=localhost",rsa,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);
  var san=new SubjectAlternativeNameBuilder();san.AddDnsName("localhost");san.AddIpAddress(System.Net.IPAddress.Loopback);request.CertificateExtensions.Add(san.Build());
  using var generated=request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1),DateTimeOffset.UtcNow.AddHours(1));
  using var certificate=X509CertificateLoader.LoadPkcs12(generated.Export(X509ContentType.Pfx),null,X509KeyStorageFlags.UserKeySet);
  await using var h=await AuthHarness.Create(browserCertificate:certificate);
  var staff=await h.Account("browser-staff@example.test");var key=await ModerationTests.Provision(h,staff.Account.Id);
  var a=await MatchingTests.Person(h,"browser-a");var b=await MatchingTests.Person(h,"browser-b");var conversation=await ChatTests.Pair(h,a,b);
  await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{conversation}/messages",new SendMessage(Guid.NewGuid(),"Browser fixture reported message"));
  await ProfileTests.Send(h,a,HttpMethod.Post,"/api/safety",new SafetyRequest(Guid.NewGuid(),"report",ConversationId:conversation,Report:new("message","spam","Browser fixture report")));
  await ProfileTests.Upload(h,a);await ProfileTests.Upload(h,b);
  var root=Directory.GetCurrentDirectory();while(!File.Exists(Path.Combine(root,"Dating-App-Tech-Stack.md")))root=Directory.GetParent(root)?.FullName??throw new InvalidOperationException("Repository missing.");
  var start=new ProcessStartInfo("node"){WorkingDirectory=root,UseShellExecute=false,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true};start.ArgumentList.Add("admin/e2e/moderation.mjs");
  using var child=Process.Start(start)!;
  await child.StandardInput.WriteAsync(JsonSerializer.Serialize(new{api=h.Client.BaseAddress!.ToString(),email="browser-staff@example.test",password=AuthHarness.Password,key,certificate=certificate.ExportCertificatePem(),privateKey=rsa.ExportPkcs8PrivateKeyPem()}));child.StandardInput.Close();
  var output=child.StandardOutput.ReadToEndAsync();var error=child.StandardError.ReadToEndAsync();
  using var timeout=new CancellationTokenSource(TimeSpan.FromMinutes(3));
  try {await child.WaitForExitAsync(timeout.Token);}catch {child.Kill(true);throw;}
  Assert.True(child.ExitCode==0,(await output)+(await error));
 }
}
