import i18n, { resources } from '../src/i18n';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Button, Text, TextInput } from '../src/components/UI';
import { useReducedMotion } from '../src/components/useReducedMotion';
import { theme } from '../src/components/theme';

test('both languages have the same nonempty keys and Georgian text survives rendering at scaled text sizes',async()=>{
 expect(Object.keys(resources.en.translation).sort()).toEqual(Object.keys(resources.ka.translation).sort());
 for(const text of Object.values(resources.ka.translation)){expect(text.trim()).not.toBe('');expect(text).not.toContain('\uFFFD');}
 await i18n.changeLanguage('ka');
 const view=render(<><Text accessibilityRole="header">{i18n.t('welcome')}</Text><TextInput accessibilityLabel={i18n.t('field_email')}/></>);
 expect(screen.getByRole('header').props.children).toMatch(/[\u10A0-\u10FF]/);expect(screen.getByRole('header').props.allowFontScaling).toBe(true);
 expect(screen.getByLabelText(i18n.t('field_email')).props.allowFontScaling).toBe(true);
 view.unmount();await i18n.changeLanguage('en');
});
test('controls expose selected/disabled state, a 48-point target and wrapping labels',()=>{
 const press=jest.fn();render(<Button title="A longer accessible action label" disabled selected onPress={press}/>);
 const button=screen.getByRole('button');expect(button.props.accessibilityState).toMatchObject({selected:true,disabled:true});
 expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);fireEvent.press(button);expect(press).not.toHaveBeenCalled();
});
test('reduced motion follows the system and cleans up its accessibility subscription',async()=>{
 let update:(value:boolean)=>void=()=>{};const remove=jest.fn();
 const initial=jest.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(true);
 const listener=jest.spyOn(AccessibilityInfo,'addEventListener').mockImplementation((event:string,callback:unknown)=>{if(event==='reduceMotionChanged')update=callback as (v:boolean)=>void;return {remove} as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;});
 function Probe(){return <Text>{useReducedMotion()?'reduced':'animated'}</Text>;}
 const view=render(<Probe/>);await waitFor(()=>expect(screen.getByText('reduced')).toBeTruthy());
 act(()=>update(false));expect(screen.getByText('animated')).toBeTruthy();view.unmount();expect(remove).toHaveBeenCalled();initial.mockRestore();listener.mockRestore();
});
function luminance(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]!*0.2126+rgb[1]!*0.7152+rgb[2]!*0.0722;}
test('normal text and button labels meet 4.5:1 contrast in the shared palette',()=>{
 for(const [foreground,background] of [[theme.colors.text,theme.colors.background],[theme.colors.muted,theme.colors.background],[theme.colors.onPrimary,theme.colors.primary],[theme.colors.danger,theme.colors.surface]]){const a=luminance(foreground!),b=luminance(background!);expect((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toBeGreaterThanOrEqual(4.5);}
});
