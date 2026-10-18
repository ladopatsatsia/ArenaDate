const fs = require('fs');
const path = require('path');

const kaPath = path.resolve('mobile/src/locales/ka.json');
const enPath = path.resolve('mobile/src/locales/en.json');
const ruPath = path.resolve('mobile/src/locales/ru.json');

const ka = JSON.parse(fs.readFileSync(kaPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));

const tableTranslations = {
  game_partner: { ka: 'მეწყვილე', en: 'Partner', ru: 'Партнер' },
  game_player: { ka: 'მოთამაშე', en: 'Player', ru: 'Игрок' },
  game_leave: { ka: 'გასვლა', en: 'Leave', ru: 'Выход' },
  game_select: { ka: 'არჩევა', en: 'Select', ru: 'Выбрать' },
  game_disconnected: { ka: 'გათიშულია', en: 'Disconnected', ru: 'Отключен' },
  game_seconds_short: { ka: 'წმ', en: 's', ru: 'сек' },
  game_bottle_spinning_title: { ka: '🌀 ბოთლი ტრიალებს...', en: '🌀 Bottle is spinning...', ru: '🌀 Бутылочка крутится...' },
  game_bottle_stopping: { ka: 'ბოთლი ჩერდება მოთამაშეზე...', en: 'Bottle is stopping on a player...', ru: 'Бутылочка останавливается на игроке...' },
  game_choose_target_prompt: { ka: 'აირჩიე მოთამაშე შეკითხვის დასასმელად ან გამოტოვე სვლა:', en: 'Choose a player to ask a question or skip turn:', ru: 'Выберите игрока чтобы задать вопрос или пропустите ход:' },
  game_bottle_stopped_on: { ka: '⏳ ბოთლი გაჩერდა: {{name}}', en: '⏳ Bottle stopped on: {{name}}', ru: '⏳ Бутылочка остановилась на: {{name}}' },
  game_partner_choosing_prompt: { ka: 'მოთამაშე ირჩევს პარტნიორს შეკითხვისთვის ან გამოტოვებს სვლას.', en: 'Player is choosing a partner or skipping.', ru: 'Игрок выбирает партнера для вопроса или пропускает ход.' },
  game_kiss_sent_to: { ka: '💋 კოცნა გაგზავნილია {{name}}-სთვის!', en: '💋 Kiss sent to {{name}}!', ru: '💋 Поцелуй отправлен для {{name}}!' },
  game_skipped: { ka: '⏭️ გამოტოვებულია', en: '⏭️ Skipped', ru: '⏭️ Пропущено' },
  game_waiting_partner_decision: { ka: 'ველოდებით მეწყვილის გადაწყვეტილებას... ({{seconds}} წმ)', en: 'Waiting for partner decision... ({{seconds}}s)', ru: 'Ожидаем решение партнера... ({{seconds}} сек)' },
  game_kiss_or_skip_title: { ka: '💋 გაუგზავნე კოცნა ან გამოტოვე!', en: '💋 Send a kiss or skip!', ru: '💋 Отправь поцелуй или пропусти!' },
  game_kiss_match_hint: { ka: 'კითხვები დასრულდა! ორმხრივი კოცნა ქმნის მეჩს.', en: 'Questions over! Mutual kisses make a match.', ru: 'Вопросы окончены! Взаимный поцелуй создает матч.' },
  game_time_to_choose: { ka: '💋 არჩევანის დროა...', en: '💋 Time to choose...', ru: '💋 Время выбирать...' },
  game_answering_question: { ka: 'პასუხობენ კითხვას.', en: 'are answering the question.', ru: 'отвечают на вопрос.' },
  game_profile_unlock_failed: { ka: 'პროფილის გახსნა ვერ მოხერხდა.', en: 'Failed to unlock profile.', ru: 'Не удалось открыть профиль.' }
};

let count = 0;
for (const [key, val] of Object.entries(tableTranslations)) {
  ka[key] = val.ka;
  en[key] = val.en;
  ru[key] = val.ru;
  count++;
}

fs.writeFileSync(kaPath, JSON.stringify(ka, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2), 'utf8');

console.log(`Added ${count} table keys across all 3 locales! Total keys: ${Object.keys(ka).length}`);
