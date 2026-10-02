import { forwardRef, type ComponentProps, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text as NativeText, TextInput as NativeInput, View, type ButtonProps, type TextProps, type TextInputProps, type ViewProps } from 'react-native';
import { Link as RouterLink } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from './theme';

export function Text({style, ...props}: TextProps) {
 const {i18n}=useTranslation();
 return <NativeText allowFontScaling accessibilityLanguage={i18n.language === 'ka' ? 'ka-GE' : 'en-US'} {...props} style={[styles.text, props.accessibilityRole==='header' && styles.heading, props.accessibilityRole==='alert' && styles.error, style]} />;
}
export function Button({title, onPress, disabled, accessibilityLabel, color, variant='secondary', selected, busy=false, ...props}: ButtonProps & {variant?:'primary'|'secondary'|'danger';selected?:boolean;busy?:boolean}) {
 const chosen=selected ?? title.startsWith('✓ ');const filled=variant==='primary'||chosen;
 return <Pressable {...props} onPress={onPress} disabled={disabled||busy} accessibilityRole="button" accessibilityLabel={accessibilityLabel??title}
  accessibilityState={{disabled:!!disabled||busy,busy,selected:chosen}} hitSlop={4}
  style={({pressed})=>[styles.button,filled&&styles.primary,variant==='danger'&&styles.danger,(disabled||busy)&&styles.disabled,pressed&&!disabled&&styles.pressed]}>
  {busy&&<ActivityIndicator color={filled?theme.colors.onPrimary:theme.colors.primary}/>}
  <Text style={[styles.buttonText,color?{color}:undefined,filled&&styles.primaryText,variant==='danger'&&styles.dangerText,(disabled||busy)&&styles.disabledText]}>{title}</Text>
 </Pressable>;
}
export const TextInput=forwardRef<NativeInput,TextInputProps>(function TextInput({style,...props},ref){
 return <NativeInput ref={ref} allowFontScaling placeholderTextColor={theme.colors.muted} selectionColor={theme.colors.primary} {...props} style={[styles.input,props.multiline&&{textAlignVertical:'top'},props.editable===false&&styles.disabled,style]}/>;
});
export function Link({style,...props}:ComponentProps<typeof RouterLink>){return <RouterLink {...props} style={[styles.link,style]}/>;}
export function Card({style,...props}:ViewProps){return <View {...props} style={[styles.card,style]}/>;}
export function StateMessage({title,body,loading=false,action}:PropsWithChildren<{title:string;body?:string;loading?:boolean;action?:{label:string;run:()=>void}}>) {
 return <Card><View style={{gap:theme.space.md}}>{loading&&<ActivityIndicator accessibilityLabel={title} color={theme.colors.primary}/>}<Text accessibilityRole="header" accessibilityLiveRegion="polite">{title}</Text>{body&&<Text>{body}</Text>}{action&&<Button title={action.label} onPress={action.run}/>}</View></Card>;
}
const styles=StyleSheet.create({
 text:{fontSize:theme.type.body,lineHeight:24,color:theme.colors.text},heading:{fontSize:theme.type.heading,fontWeight:'700',lineHeight:32},error:{color:theme.colors.danger},
 button:{minHeight:theme.touch,paddingVertical:12,paddingHorizontal:18,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.control,backgroundColor:theme.colors.surface,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},
 primary:{backgroundColor:theme.colors.primary,borderColor:theme.colors.primary},danger:{borderColor:theme.colors.danger},disabled:{backgroundColor:theme.colors.disabled,borderColor:theme.colors.disabled},pressed:{opacity:0.8},
 buttonText:{color:theme.colors.primary,fontWeight:'600',textAlign:'center',flexShrink:1},primaryText:{color:theme.colors.onPrimary},dangerText:{color:theme.colors.danger},disabledText:{color:theme.colors.muted},
 input:{minHeight:52,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.control,padding:14,fontSize:theme.type.body,lineHeight:24,color:theme.colors.text,backgroundColor:theme.colors.surface},
 link:{minHeight:theme.touch,paddingVertical:12,paddingHorizontal:4,fontSize:16,lineHeight:24,fontWeight:'600',color:theme.colors.primary,textDecorationLine:'underline'},
 card:{backgroundColor:theme.colors.surface,borderRadius:theme.radius.card,padding:theme.space.lg,borderWidth:1,borderColor:theme.colors.border,gap:theme.space.md},
});
