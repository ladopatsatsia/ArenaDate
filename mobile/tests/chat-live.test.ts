import { LiveChat,type LiveConnection } from '../src/chat/live';
jest.mock('@microsoft/signalr',()=>({}));
function connection() {
 let hint=()=>{};let close=()=>{};
 const value:LiveConnection={start:jest.fn(async()=>{}),stop:jest.fn(async()=>{}),subscribe:jest.fn(async()=>{}),onHint:fn=>{hint=fn;},onClose:fn=>{close=fn;}};
 return {value,hint:()=>hint(),close:()=>close()};
}
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
beforeEach(()=>jest.useFakeTimers());afterEach(()=>jest.useRealTimers());
test('initial failure backs off, subscribes before catchup, and resumes from persisted history after disconnect',async()=>{
 const first=connection();jest.mocked(first.value.start).mockRejectedValueOnce(new Error('offline'));
 const second=connection();const third=connection();const factory=jest.fn().mockReturnValueOnce(first.value).mockReturnValueOnce(second.value).mockReturnValue(third.value);
 const catchup=jest.fn(async()=>{});const status=jest.fn();const live=new LiveChat(factory,catchup,status);
 live.start();await flush();expect(catchup).not.toHaveBeenCalled();expect(factory).toHaveBeenCalledTimes(1);
 jest.advanceTimersByTime(1000);await flush();expect(second.value.subscribe).toHaveBeenCalled();expect(catchup).toHaveBeenCalledTimes(1);
 second.hint();await flush();expect(catchup).toHaveBeenCalledTimes(2);
 second.close();jest.advanceTimersByTime(1000);await flush();expect(third.value.subscribe).toHaveBeenCalled();expect(catchup).toHaveBeenCalledTimes(3);
 await live.stop();third.hint();third.close();jest.advanceTimersByTime(60000);await flush();expect(factory).toHaveBeenCalledTimes(3);
});
test('stopping a pending connection prevents stale subscription or updates, then foreground start uses a new connection',async()=>{
 const first=connection();let release=()=>{};jest.mocked(first.value.start).mockImplementation(()=>new Promise<void>(resolve=>{release=resolve;}));
 const second=connection();const factory=jest.fn().mockReturnValueOnce(first.value).mockReturnValue(second.value);const catchup=jest.fn(async()=>{});
 const live=new LiveChat(factory,catchup,jest.fn());live.start();await live.stop();live.start();await flush();release();await flush();
 expect(first.value.subscribe).not.toHaveBeenCalled();expect(second.value.subscribe).toHaveBeenCalledTimes(1);expect(catchup).toHaveBeenCalledTimes(1);await live.stop();
});

test('live revocation stops delivery and reconnect, including stale callbacks',async()=>{
 const wire=connection();let revoke=()=>{};wire.value.onRevoked=fn=>{revoke=fn;};
 const factory=jest.fn(()=>wire.value);const catchup=jest.fn(async()=>{});const revoked=jest.fn();
 const live=new LiveChat(factory,catchup,jest.fn(),revoked);live.start();await flush();revoke();await flush();
 expect(revoked).toHaveBeenCalledTimes(1);expect(wire.value.stop).toHaveBeenCalled();
 wire.hint();wire.close();jest.advanceTimersByTime(60000);await flush();
 expect(catchup).toHaveBeenCalledTimes(1);expect(factory).toHaveBeenCalledTimes(1);
});
