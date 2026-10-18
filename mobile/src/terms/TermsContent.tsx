import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Text } from '../components/UI';
import { theme } from '../components/theme';

export function TermsContent() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ka';

  const isKa = lang.startsWith('ka');
  const isRu = lang.startsWith('ru');

  const termsList = [
    {
      icon: '🔞',
      title: isKa
        ? 'ასაკობრივი შეზღუდვა (18+)'
        : isRu
        ? 'Возрастное ограничение (18+)'
        : 'Age Requirement (18+)',
      desc: isKa
        ? 'ARENA-ს გამოყენება დაშვებულია მხოლოდ 18 წელს მიღწეული სრულწლოვანი პირებისთვის. არასრულწლოვნების რეგისტრაცია დაუშვებელია და მათი ანგარიში ექვემდებარება დაუყოვნებლივ გაუქმებას.'
        : isRu
        ? 'Использование ARENA разрешено только лицам, достигшим 18 лет. Регистрация несовершеннолетних строго запрещена, а их аккаунты подлежат немедленной блокировке.'
        : 'ARENA is exclusively for adults aged 18 and older. Registration by minors is strictly prohibited, and such accounts are subject to immediate termination.',
      highlight: isKa ? 'მკაცრი მოთხოვნა' : isRu ? 'Строгое требование' : 'Strict Requirement',
      badgeColor: '#EF4444',
    },
    {
      icon: '🤝',
      title: isKa
        ? 'ურთიერთპატივისცემა და ეთიკა'
        : isRu
        ? 'Взаимное уважение и этика'
        : 'Mutual Respect & Ethics',
      desc: isKa
        ? 'აკრძალულია შეურაცხმყოფელი ქცევა, მუქარა, ბულინგი, დისკრიმინაცია, სიძულვილის ენა და არასასურველი შევიწროება. პატივი ეცით თითოეული მომხმარებლის პირად საზღვრებს.'
        : isRu
        ? 'Запрещены оскорбительное поведение, угрозы, травля, дискриминация, разжигание ненависти и домогательства. Уважайте личные границы каждого пользователя.'
        : 'Harassment, hate speech, threats, bullying, discrimination, and unwelcome conduct are strictly forbidden. Always respect the personal boundaries of others.',
      highlight: isKa ? 'უსაფრთხო გარემო' : isRu ? 'Безопасная среда' : 'Safe Environment',
      badgeColor: '#8B5CF6',
    },
    {
      icon: '📸',
      title: isKa
        ? 'ფოტოები და კონტენტის წესები'
        : isRu
        ? 'Фотографии и контент'
        : 'Photos & Content Policy',
      desc: isKa
        ? 'პროფილში ნებადართულია მხოლოდ საკუთარი, რეალური ფოტოების ატვირთვა. კატეგორიულად იკრძალება პორნოგრაფიული, ინტიმური, ძალადობრივი, უკანონო ან სხვისი უფლებების დამრღვევი მასალა.'
        : isRu
        ? 'Разрешается загружать только свои реальные фотографии. Категорически запрещены порнографические, интимные, насильственные, незаконные или чужие материалы.'
        : 'Upload only authentic photos of yourself. Explicit nudity, pornography, violent, illegal, or copyrighted material without permission is strictly prohibited.',
      highlight: isKa ? 'რეალური პროფილები' : isRu ? 'Реальные профили' : 'Real Profiles',
      badgeColor: '#EC4899',
    },
    {
      icon: '💳',
      title: isKa
        ? 'თაღლითობა და ფინანსური უსაფრთხოება'
        : isRu
        ? 'Мошенничество и финансовая безопасность'
        : 'Anti-Fraud & Financial Safety',
      desc: isKa
        ? 'არასოდეს გადაურიცხოთ თანხა და არ გაუზიაროთ საბანკო მონაცემები უცნობ პირებს. პლატფორმაზე აკრძალულია ნებისმიერი კომერციული მომსახურების გაყიდვა, სპამი და თაღლითობა.'
        : isRu
        ? 'Никогда не переводите деньги и не делитесь банковскими данными с незнакомцами. Запрещена продажа любых коммерческих услуг, спам и финансовое мошенничество.'
        : 'Never transfer funds or disclose banking or card credentials to strangers. Commercial selling of services, spam, and financial scams are strictly forbidden.',
      highlight: isKa ? 'ფინანსური დაცვა' : isRu ? 'Финансовая защита' : 'Financial Protection',
      badgeColor: '#F59E0B',
    },
    {
      icon: '☕',
      title: isKa
        ? 'პირისპირ შეხვედრის რეკომენდაციები'
        : isRu
        ? 'Рекомендации для реальных встреч'
        : 'In-Person Meeting Guidelines',
      desc: isKa
        ? 'პირველი შეხვედრისთვის ყოველთვის აირჩიეთ საჯარო, ხალხმრავალი ადგილები (კაფე, პარკი). წინასწარ შეატყობინეთ ახლობელს ან მეგობარს, სად და ვისთან ერთად იმყოფებით.'
        : isRu
        ? 'Для первой встречи всегда выбирайте общественные, людные места (кафе, парк). Заранее сообщите близкому человеку, куда и с кем вы идете.'
        : 'Always choose public, crowded locations (cafes, restaurants, parks) for your first in-person meetings. Inform a friend or family member of your plans.',
      highlight: isKa ? 'სიფრთხილე' : isRu ? 'Осторожность' : 'Be Careful',
      badgeColor: '#10B981',
    },
    {
      icon: '🚨',
      title: isKa
        ? 'დაბლოკვა და რეპორტი (საჩივრები)'
        : isRu
        ? 'Блокировка и жалобы'
        : 'Blocking & Reporting',
      desc: isKa
        ? 'ნებისმიერი საეჭვო ან შეურაცხმყოფელი ქცევის შემთხვევაში დაუყოვნებლივ დაბლოკეთ მომხმარებელი და გააგზავნეთ საჩივარი. მოდერაციის გუნდი განიხილავს თითოეულ შეტყობინებას.'
        : isRu
        ? 'При любом подозрительном или неприемлемом поведении заблокируйте пользователя и отправьте жалобу. Команда модерации проверяет каждое обращение.'
        : 'If you encounter any abusive or suspicious behavior, immediately block the user and submit a report. The moderation team reviews each report diligently.',
      highlight: isKa ? 'მოდერაცია' : isRu ? 'Модерация' : 'Moderation',
      badgeColor: '#06B6D4',
    },
    {
      icon: '🔒',
      title: isKa
        ? 'კონფიდენციალურობა და მონაცემები'
        : isRu
        ? 'Конфиденциальность и данные'
        : 'Privacy & Data Protection',
      desc: isKa
        ? 'თქვენი პირადი მონაცემები დაცულია და არ გადაეცემა მესამე პირებს. თქვენ ნებისმიერ დროს შეგიძლიათ შეცვალოთ პარამეტრები ან მოითხოვოთ ანგარიშის წაშლა.'
        : isRu
        ? 'Ваши персональные данные защищены и не передаются третьим лицам. Вы можете в любой момент изменить настройки или запросить удаление аккаунта.'
        : 'Your personal data is encrypted and never sold to third parties. You can adjust your privacy settings or request account deletion at any time.',
      highlight: isKa ? 'დაცული მონაცემები' : isRu ? 'Защита данных' : 'Data Privacy',
      badgeColor: '#3B82F6',
    },
  ];

  return (
    <View style={styles.container}>
      {termsList.map((item, idx) => (
        <Card key={idx} style={styles.termCard}>
          <View style={styles.termHeaderRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <View style={styles.titleCol}>
              <Text style={styles.termTitle}>{item.title}</Text>
              <View style={[styles.badgePill, { borderColor: item.badgeColor }]}>
                <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                  {item.highlight}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.termDesc}>{item.desc}</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 24,
  },
  termCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  termHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconText: {
    fontSize: 22,
  },
  titleCol: {
    flex: 1,
    gap: 4,
  },
  termTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  badgePill: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  termDesc: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 19,
  },
});
