import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button } from './UI';
import { theme } from './theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export function Screen({ title, children, scroll=true }: PropsWithChildren<{ title: string; scroll?:boolean }>) {
  const { t, i18n } = useTranslation();
  const heading=<View style={styles.heading}><Text style={styles.brand}>DATINGMVP</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text></View>;
  const language=<Button testID="language-toggle" title={`${t('language')}: ${i18n.language === 'ka' ? 'English' : 'ქართული'}`} onPress={() => { void i18n.changeLanguage(i18n.language === 'ka' ? 'en' : 'ka'); }} />;
  return <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
   <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?64:0}>
    {scroll?<ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
      {heading}
      <View style={styles.body}>{children}</View>
      {language}
    </ScrollView>:<View style={{flex:1}}><View style={{padding:20}}>{heading}</View>{children}<View style={{padding:12}}>{language}</View></View>}
   </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 20, gap: 28,flexGrow:1 }, heading:{gap:8},brand:{fontSize:12,fontWeight:'700',letterSpacing:2,color:theme.colors.primary},title: { fontSize: 30,lineHeight:42,fontWeight: '700', color: theme.colors.text }, body: { gap: 20 } });
