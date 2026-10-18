const fs = require('fs');
const path = require('path');

const kaPath = path.resolve('mobile/src/locales/ka.json');
const enPath = path.resolve('mobile/src/locales/en.json');
const ruPath = path.resolve('mobile/src/locales/ru.json');

const ka = JSON.parse(fs.readFileSync(kaPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));

const newTranslations = {
  // Filters
  filters_show_me: { ka: 'ვინ გაინტერესებს', en: 'Show Me', ru: 'Кто вас интересует' },
  filters_everyone: { ka: 'ყველა', en: 'Everyone', ru: 'Все' },
  filters_selected_count: { ka: '{{count}} არჩეული', en: '{{count}} selected', ru: '{{count}} выбрано' },
  filters_opt_woman_title: { ka: 'ქალები', en: 'Women', ru: 'Девушки' },
  filters_opt_woman_sub: { ka: 'მხოლოდ ქალების პროფილები', en: 'Female profiles', ru: 'Только женские анкеты' },
  filters_opt_man_title: { ka: 'კაცები', en: 'Men', ru: 'Парни' },
  filters_opt_man_sub: { ka: 'მხოლოდ კაცების პროფილები', en: 'Male profiles', ru: 'Только мужские анкеты' },
  filters_opt_nonbinary_title: { ka: 'ყველა / არაბინარული', en: 'Everyone / Non-binary', ru: 'Все / Небинарные' },
  filters_opt_nonbinary_sub: { ka: 'ნებისმიერი გენდერის პროფილები', en: 'All gender profiles', ru: 'Анкеты любого гендера' },
  filters_age_range: { ka: 'ასაკობრივი დიაპაზონი', en: 'Age Range', ru: 'Возрастной диапазон' },
  filters_years: { ka: 'წელი', en: 'years', ru: 'лет' },
  filters_min_age: { ka: 'მინიმალური ასაკი', en: 'Min Age', ru: 'Минимальный возраст' },
  filters_max_age: { ka: 'მაქსიმალური ასაკი', en: 'Max Age', ru: 'Максимальный возраст' },
  filters_quick_presets: { ka: 'სწრაფი არჩევანი:', en: 'Quick Presets:', ru: 'Быстрый выбор:' },
  filters_location_and_mode: { ka: 'ლოკაცია და რეჟიმი', en: 'Location & Mode', ru: 'Локация и режим' },
  filters_city_label: { ka: 'ქალაქი', en: 'City', ru: 'Город' },
  filters_search_mode: { ka: 'ძებნის რეჟიმი:', en: 'Search Mode:', ru: 'Режим поиска:' },
  filters_mode_by_city: { ka: 'ქალაქის მიხედვით', en: 'By City', ru: 'По городу' },
  filters_mode_by_distance: { ka: 'მანძილით (GPS)', en: 'By Distance (GPS)', ru: 'По расстоянию (GPS)' },
  filters_max_distance: { ka: 'მაქსიმალური მანძილი:', en: 'Maximum Distance:', ru: 'Максимальное расстояние:' },
  filters_km: { ka: 'კმ', en: 'km', ru: 'км' },
  filters_save_btn: { ka: 'პარამეტრების შენახვა', en: 'Apply Preferences', ru: 'Применить настройки' },

  // Language Picker Modal
  lang_picker_sub: { ka: 'აირჩიე მაქსიმუმ {{count}} ენა ({{selected}}/{{count}})', en: 'Select up to {{count}} languages ({{selected}}/{{count}})', ru: 'Выберите до {{count}} языков ({{selected}}/{{count}})' },
  lang_picker_search_placeholder: { ka: 'მოძებნე ენა (მაგ. ინგლისური, Deutsch...)', en: 'Search language (e.g. English, French...)', ru: 'Поиск языка (напр. Английский, Немецкий...)' },
  lang_picker_selected_header: { ka: 'არჩეული ენები:', en: 'Selected:', ru: 'Выбранные:' },
  lang_picker_popular_header: { ka: 'პოპულარული ენები:', en: 'Popular:', ru: 'Популярные:' },
  lang_picker_not_found: { ka: 'ენა ვერ მოიძებნა', en: 'No languages found', ru: 'Язык не найден' },

  // Swipe Deck
  swipe_more_info: { ka: 'მეტი ინფო', en: 'More Info', ru: 'Больше инфо' },

  // Profile Editor
  profile_no_languages_selected: { ka: 'ენები ჯერ არ არის არჩეული', en: 'No languages selected yet', ru: 'Языки еще не выбраны' },
  profile_edit_languages: { ka: '✏️ ენების რედაქტირება / დამატება', en: '✏️ Edit / Add languages', ru: '✏️ Редактировать / добавить языки' },
  profile_add_languages: { ka: '🔍 + ენის მოძებნა და დამატება', en: '🔍 + Search and add languages', ru: '🔍 + Найти и добавить языки' },

  // Onboarding
  onboarding_name_placeholder: { ka: 'მაგ. ალექსანდრე', en: 'e.g. Alex', ru: 'напр. Александр' },
  onboarding_custom_city_placeholder: { ka: 'ჩაწერეთ ქალაქის სახელი', en: 'Enter city name', ru: 'Введите название города' },
  city_other: { ka: 'სხვა', en: 'Other', ru: 'Другой' },

  // Premium Modal
  premium_pkg_2weeks_name: { ka: '2 კვირა', en: '2 Weeks', ru: '2 Недели' },
  premium_pkg_2weeks_desc: { ka: 'სწრაფი წვდომა 14 დღით', en: 'Quick access for 14 days', ru: 'Быстрый доступ на 14 дней' },
  premium_pkg_1month_name: { ka: '1 თვე', en: '1 Month', ru: '1 Месяц' },
  premium_pkg_1month_desc: { ka: 'ყველაზე პოპულარული არჩევანი', en: 'Most popular choice', ru: 'Самый популярный выбор' },
  premium_pkg_1month_badge: { ka: 'პოპულარული', en: 'Popular', ru: 'Популярный' },
  premium_pkg_3months_name: { ka: '3 თვე', en: '3 Months', ru: '3 Месяца' },
  premium_pkg_3months_desc: { ka: 'ეკონომიური პაკეტი', en: 'Economy bundle', ru: 'Экономный пакет' },
  premium_pkg_3months_badge: { ka: 'ეკონომია', en: 'Save 30%', ru: 'Экономия' },
  premium_pkg_lifetime_name: { ka: 'ულიმიტო', en: 'Lifetime', ru: 'Навсегда' },
  premium_pkg_lifetime_desc: { ka: 'ერთხელ გადახდა, სამუდამო პრემიუმი', en: 'Pay once, lifetime VIP', ru: 'Один платеж, вечный VIP' },
  premium_pkg_lifetime_badge: { ka: 'საუკეთესო', en: 'Best Value', ru: 'Лучший' },

  // Game Lobby Modes
  game_mode_6_title: { ka: '6 მოთამაშე', en: '6 Players', ru: '6 Игроков' },
  game_mode_6_tag: { ka: 'სწრაფი', en: 'Fast', ru: 'Быстрый' },
  game_mode_6_quota: { ka: '3 ♀ + 3 ♂ კვოტა', en: '3 ♀ + 3 ♂ quota', ru: 'Квота 3 ♀ + 3 ♂' },
  game_mode_8_title: { ka: '8 მოთამაშე', en: '8 Players', ru: '8 Игроков' },
  game_mode_8_tag: { ka: 'კლასიკური', en: 'Classic', ru: 'Классический' },
  game_mode_8_quota: { ka: '4 ♀ + 4 ♂ კვოტა', en: '4 ♀ + 4 ♂ quota', ru: 'Квота 4 ♀ + 4 ♂' },
  game_mode_10_title: { ka: '10 მოთამაშე', en: '10 Players', ru: '10 Игроков' },
  game_mode_10_tag: { ka: 'დიდი არენა', en: 'Grand Arena', ru: 'Большая арена' },
  game_mode_10_quota: { ka: '5 ♀ + 5 ♂ კვოტა', en: '5 ♀ + 5 ♂ quota', ru: 'Квота 5 ♀ + 5 ♂' },

  // Game Lobby Actions & Status
  game_dev_seed_failed: { ka: 'სატესტო მოთამაშეების დამატება ვერ მოხერხდა', en: 'Failed to add test players', ru: 'Не удалось добавить тестовых игроков' },
  game_dev_seed_btn: { ka: '🧪 სატესტო მოთამაშეებით შევსება', en: '🧪 Fill with Test Players', ru: '🧪 Заполнить тест-игроками' },
  game_dev_seed_hint: { ka: '⚡ დააჭირე, რომ მაგიდა მყისიერად შეივსოს მოთამაშეებით და თამაში დაიწყოს', en: '⚡ Tap to instantly fill table with players and start', ru: '⚡ Нажмите, чтобы заполнить стол и начать игру' },
  game_dev_seed_lobby_hint: { ka: 'დაამატე ტესტ-მოთამაშეები კვოტის შესავსებად და თამაშის დასაწყებად', en: 'Add test players to fill quotas and start the game', ru: 'Добавьте тест-игроков для квоты и начала игры' },
  game_leave_and_back: { ka: 'მაგიდის დატოვება და უკან დაბრუნება', en: 'Leave table and go back', ru: 'Покинуть стол и вернуться' },
  game_leave_cancel_search: { ka: '🚪 მაგიდის დატოვება (ძიების გაუქმება)', en: '🚪 Leave table (Cancel search)', ru: '🚪 Покинуть стол (Отменить поиск)' },
  game_lobby_badge: { ka: 'ლობი', en: 'Lobby', ru: 'Лобби' },
  game_table_full_badge: { ka: 'სავსეა', en: 'Full', ru: 'Заполнен' },
  game_table_enter_btn: { ka: 'შესვლა', en: 'Join', ru: 'Войти' },
  game_slot_free: { ka: 'თავისუფალი', en: 'Available', ru: 'Свободно' },
  game_you_label: { ka: 'შენ · ', en: 'You · ', ru: 'Вы · ' },
  game_years_short: { ka: 'წლ.', en: 'y/o', ru: 'лет' },

  // Game Table
  game_pair_deciding: { ka: '{{p1}} და {{p2}} აკეთებენ არჩევანს.', en: '{{p1}} and {{p2}} are choosing.', ru: '{{p1}} и {{p2}} делают выбор.' },
  game_idle_status: { ka: 'თამაში აქტიურია · მოემზადეთ შემდეგი სვლისთვის', en: 'Game active · Get ready for next turn', ru: 'Игра активна · Приготовьтесь к следующему ходу' },
  game_question_header: { ka: 'კითხვა {{current}} / {{total}}', en: 'Question {{current}} / {{total}}', ru: 'Вопрос {{current}} / {{total}}' },
  game_pair_label: { ka: '✨ წყვილი: {{p1}} & {{p2}}', en: '✨ Pair: {{p1}} & {{p2}}', ru: '✨ Пара: {{p1}} & {{p2}}' },
  game_question_skipped: { ka: '⏳ კითხვა გამოტოვებულია', en: '⏳ Question skipped', ru: '⏳ Вопрос пропущен' },
  game_question_matched: { ka: '🎉 თანხვედრა! ორივემ ერთი და იგივე აირჩიეთ!', en: '🎉 Match! Both of you picked the same!', ru: '🎉 Совпадение! Вы оба выбрали одинаково!' },
  game_question_differed: { ka: '✨ განსხვავებული ხედვები!', en: '✨ Different perspectives!', ru: '✨ Разные взгляды!' },
  game_question_pair_matched: { ka: '🎉 წყვილს ჰქონდა თანხვედრა!', en: '🎉 The pair matched!', ru: '🎉 У пары совпали ответы!' },
  game_question_pair_differed: { ka: '✨ წყვილს ჰქონდა განსხვავებული არჩევანი', en: '✨ The pair had different choices', ru: '✨ У пары разные выборы' },
  game_question_round_summary: { ka: '🤖 რაუნდის შეჯამება', en: '🤖 Round Summary', ru: '🤖 Итоги раунда' },
  game_waiting_partner_choice: { ka: '🔒 არჩევანი დაფიქსირებულია. ველოდებით მეწყვილის პასუხს...', en: '🔒 Choice recorded. Waiting for partner answer...', ru: '🔒 Выбор зафиксирован. Ожидаем ответ партнера...' },
  game_match_success_desc: { ka: 'შენ და {{name}}-მა ერთმანეთს კოცნა გაუგზავნეთ!', en: 'You and {{name}} sent kisses to each other!', ru: 'Вы и {{name}} отправили друг другу поцелуи!' },
  game_match_saved_note: { ka: 'თქვენი კავშირი შეინახა Matches განყოფილებაში.', en: 'Your match is saved in the Matches tab.', ru: 'Ваш матч сохранен во вкладке Matches.' },
  game_ended_title: { ka: 'თამაში დასრულდა!', en: 'Game Over!', ru: 'Игра окончена!' },
  game_ended_desc: { ka: '18 დატრიალება წარმატებით დასრულდა. მაგიდა დაიხურა.', en: '18 spins completed. Table closed.', ru: '18 вращений завершены. Стол закрыт.' },
  game_ended_kiss_prompt: { ka: 'შეგიძლია კოცნა გაუგზავნო მაგიდის ნებისმიერ მონაწილეს. ფანჯრის დახურვის შემდეგ მაგიდას დატოვებ.', en: 'You can send kisses to any table player. After closing you will leave the table.', ru: 'Вы можете поцеловать любого участника за столом. После закрытия вы покинете стол.' },
  game_kiss_already_sent: { ka: '✓ გაგზავნილია', en: '✓ Sent', ru: '✓ Отправлено' },
  game_kiss_btn: { ka: '💋 აკოცე', en: '💋 Kiss', ru: '💋 Поцеловать' },
  game_close_and_leave: { ka: '✕ დახურვა და მაგიდის დატოვება', en: '✕ Close and leave table', ru: '✕ Закрыть и выйти из-за стола' },
  game_loading_profile: { ka: 'იტვირთება პროფილი...', en: 'Loading profile...', ru: 'Загрузка профиля...' },
  game_bio_title: { ka: 'ბიოგრაფია', en: 'Bio', ru: 'О себе' },
  game_no_info: { ka: 'ინფორმაცია არ არის', en: 'No information', ru: 'Нет информации' },
  game_profile_locked_desc: { ka: '🔒 სრული პროფილი (ინტერესები, მიზნები, ფოტოები) დახურულია', en: '🔒 Full profile (interests, goals, photos) is locked', ru: '🔒 Полный профиль (интересы, цели, фото) закрыт' },
  game_unlock_profile_btn: { ka: '💎 25 - სრული პროფილის გახსნა', en: '💎 25 - Unlock Full Profile', ru: '💎 25 - Открыть полный профиль' },
  game_unlock_profile_prompt: { ka: '25 კრისტალად გაიხსნება {{name}}-ის სრული პროფილი. მომხმარებელი მიიღებს შეტყობინებას, რომ მის პროფილს ნახულობთ.', en: 'Unlock {{name}}\'s full profile for 25 crystals. They will receive a notification that you viewed their profile.', ru: 'За 25 кристаллов откроется полный профиль {{name}}. Пользователь получит уведомление о просмотре.' },
  game_gift_prompt: { ka: 'აჩუქე {{name}}-ს საჩუქარი (1 - 500 💎):', en: 'Send a gift to {{name}} (1 - 500 💎):', ru: 'Подарите {{name}} подарок (1 - 500 💎):' },
  game_direct_request_desc: { ka: 'გაუგზავნე მეჩის რექუესტი პირადი წერილით (1 მესიჯი). მეორე მხარეს გამოუჩნდება თანხმობის და უარყოფის ღილაკები.', en: 'Send a match request with a private note (1 message). The recipient will get accept and decline options.', ru: 'Отправьте запрос на матч с личным сообщением. Собеседник увидит кнопки согласия и отказа.' },
  game_direct_request_sent: { ka: '✓ რექუესტი უკვე გაგზავნილია (პასუხის მოლოდინში)', en: '✓ Request already sent (Waiting for response)', ru: '✓ Запрос уже отправлен (Ожидание ответа)' },
  game_direct_request_send_btn: { ka: '💌 რექუესტის გაგზავნა (125 💎)', en: '💌 Send Request (125 💎)', ru: '💌 Отправить запрос (125 💎)' },
  game_direct_request_insufficient: { ka: '💎 125 - არასაკმარისი ბალანსი ({{balance}} 💎)', en: '💎 125 - Insufficient balance ({{balance}} 💎)', ru: '💎 125 - Недостаточно кристаллов ({{balance}} 💎)' },
  game_direct_request_success: { ka: '💌 რექუესტი წარმატებით გაიგზავნა!', en: '💌 Request sent successfully!', ru: '💌 Запрос успешно отправлен!' },
  game_direct_request_err_funds: { ka: 'არასაკმარისი კრისტალები (საჭიროა 125 💎).', en: 'Insufficient crystals (125 💎 required).', ru: 'Недостаточно кристаллов (требуется 125 💎).' },
  game_direct_request_err_already: { ka: 'რექუესტი უკვე გაგზავნილია.', en: 'Request already sent.', ru: 'Запрос уже отправлен.' },
  game_direct_request_err_failed: { ka: 'რექუესტის გაგზავნა ვერ მოხერხდა.', en: 'Failed to send request.', ru: 'Не удалось отправить запрос.' },
  game_profile_unavailable: { ka: 'პროფილი მიუწვდომელია', en: 'Profile unavailable', ru: 'Профиль недоступен' },
  game_incoming_request_title: { ka: 'ახალი მეჩის რექუესტი!', en: 'New Match Request!', ru: 'Новый запрос на матч!' },
  game_incoming_request_subtitle: { ka: '{{name}}, {{age}} წლის', en: '{{name}}, {{age}} y/o', ru: '{{name}}, {{age}} лет' },
  game_incoming_message_label: { ka: 'შეტყობინება:', en: 'Message:', ru: 'Сообщение:' },
  game_incoming_accept_note: { ka: 'თანხმობის შემთხვევაში შეიქმნება მეჩი და ჩატი გაიხსნება!', en: 'Accepting will create a match and open the chat!', ru: 'При согласии будет создан матч и откроется чат!' },

  // Room Chat Modal
  room_chat_header_title: { ka: '💬 საერთო ჩატი', en: '💬 Table Chat', ru: '💬 Общий чат' },
  room_chat_header_sub: { ka: 'მაგიდის მონაწილეების მიმოწერა', en: 'Table participants conversation', ru: 'Переписка участников стола' },
  room_chat_close: { ka: 'ჩატის დახურვა', en: 'Close chat', ru: 'Закрыть чат' },
  room_chat_loading: { ka: 'შეტყობინებები იტვირთება...', en: 'Loading messages...', ru: 'Сообщения загружаются...' },
  room_chat_empty_title: { ka: 'ჯერ მიმოწერა არ არის', en: 'No messages yet', ru: 'Пока нет сообщений' },
  room_chat_empty_sub: { ka: 'მიესალმეთ მაგიდის წევრებს ან გამოიყენეთ სწრაფი რეაქციები ქვემოთ!', en: 'Say hello to table members or tap a quick reaction below!', ru: 'Поприветствуйте участников стола или отправьте быструю реакцию ниже!' },
  room_chat_placeholder: { ka: 'დაწერე შეტყობინება...', en: 'Write a message...', ru: 'Напишите сообщение...' },
  room_chat_send: { ka: 'შეტყობინების გაგზავნა', en: 'Send message', ru: 'Отправить сообщение' },
  chip_hello: { ka: '👋 სალამი!', en: '👋 Hello!', ru: '👋 Привет!' },
  chip_spin: { ka: '🍾 დაატრიალე!', en: '🍾 Spin it!', ru: '🍾 Крути!' },
  chip_haha: { ka: '😂 ჰაჰა', en: '😂 Haha', ru: '😂 Хаха' },
  chip_cool: { ka: '🔥 მაგარია', en: '🔥 Cool', ru: '🔥 Круто' },
  chip_kiss: { ka: '❤️ კოცნა', en: '❤️ Kiss', ru: '❤️ Поцелуй' },
  chip_cheers: { ka: '🥂 გაუმარჯოს!', en: '🥂 Cheers!', ru: '🥂 За нас!' }
};

let added = 0;
for (const [key, val] of Object.entries(newTranslations)) {
  ka[key] = val.ka;
  en[key] = val.en;
  ru[key] = val.ru;
  added++;
}

fs.writeFileSync(kaPath, JSON.stringify(ka, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2), 'utf8');

console.log(`Successfully inserted ${added} new keys across ka.json, en.json, and ru.json!`);
console.log(`Total keys now in ka: ${Object.keys(ka).length}, en: ${Object.keys(en).length}, ru: ${Object.keys(ru).length}`);
