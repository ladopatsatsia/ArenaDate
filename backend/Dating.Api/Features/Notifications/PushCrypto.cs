using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Notifications;
public sealed class PushCrypto(IOptions<PushOptions> options) {
 public static string Hash(string value)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
 public static bool SameHash(string a,string b)=>CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(a),Encoding.ASCII.GetBytes(b));
 public (string KeyId,string Ciphertext) Seal(Guid installation,string value){
  var o=options.Value;var nonce=RandomNumberGenerator.GetBytes(12);var plain=Encoding.UTF8.GetBytes(value);var cipher=new byte[plain.Length];var tag=new byte[16];
  using var aes=new AesGcm(Convert.FromBase64String(o.Keys[o.CurrentKeyId]),16);
  aes.Encrypt(nonce,plain,cipher,tag,installation.ToByteArray());
  return(o.CurrentKeyId,Convert.ToBase64String([..nonce,..tag,..cipher]));
 }
 public string Open(PushDevice device){
  var bytes=Convert.FromBase64String(device.Ciphertext);if(bytes.Length<28)throw new CryptographicException();
  var plain=new byte[bytes.Length-28];using var aes=new AesGcm(Convert.FromBase64String(options.Value.Keys[device.KeyId]),16);
  aes.Decrypt(bytes.AsSpan(0,12),bytes.AsSpan(28),bytes.AsSpan(12,16),plain,device.Id.ToByteArray());return Encoding.UTF8.GetString(plain);
 }
}
