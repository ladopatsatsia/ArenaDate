import '../src/i18n';
import { fireEvent,render,screen,waitFor } from '@testing-library/react-native';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { PrivatePhoto } from '../src/profile/PrivatePhoto';
const mockImage=jest.fn();
jest.mock('../src/profile/api',()=>({ProfileApi:jest.fn(()=>({image:mockImage}))}));
jest.mock('../src/auth/AuthProvider',()=>({useAuth:()=>({state:{account:{id:'A'}},api:{},manager:{}})}));
test('private photo failure has retry, decoding failure hides bytes, and unmount releases the image cache',async()=>{
 mockImage.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue('data:image/jpeg;base64,test');
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=render(<QueryClientProvider client={cache}><PrivatePhoto photo={{id:'photo',state:'approved',position:0,width:600,height:400}}/></QueryClientProvider>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Retry'})).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByRole('image')).toBeTruthy());
 fireEvent(screen.getByRole('image'),'error');expect(screen.queryByRole('image')).toBeNull();expect(screen.getByRole('button',{name:'Retry'})).toBeTruthy();
 view.unmount();await waitFor(()=>expect(cache.getQueryCache().getAll()).toHaveLength(0));cache.clear();
});
