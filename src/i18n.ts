import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      'app_title': 'AI Book Writer',
      'new_book': 'New Book',
      'my_books': 'My Books',
      'idea_placeholder': 'What is your book about? E.g., A sci-fi novel about a detective solving crimes in a city where memories can be traded.',
      'generate_proposals': 'Generate Proposals',
      'proposals_title': 'Select a Proposal',
      'generating': 'Generating...',
      'outline_summary': 'Outline & Summary',
      'generate_outline': 'Generate Outline',
      'chapters': 'Chapters',
      'generate_content': 'Generate Content',
      'generate_image': 'Generate Image',
      'delete_book': 'Delete Book',
      'settings': 'Settings',
      'theme': 'Theme',
      'language': 'Language',
      'light': 'Light',
      'dark': 'Dark',
      'system': 'System',
      'back': 'Back',
      'save': 'Save',
      'saved': 'Saved',
      'no_books': 'No books yet. Start your first masterpiece!',
      'chapter_content_placeholder': 'Chapter content will appear here...',
      'book_idea': 'Book Idea',
      'step_1': 'Step 1: The Idea',
      'step_2': 'Step 2: The Proposal',
      'step_3': 'Step 3: The Outline',
      'target_audience': 'Target Audience',
      'tone': 'Tone',
      'concept': 'Concept',
      'select': 'Select',
      'creating_book': 'Creating your book...',
    }
  },
  zh: {
    translation: {
      'app_title': 'AI 智能写书',
      'new_book': '新建书籍',
      'my_books': '我的书籍',
      'idea_placeholder': '你的书是关于什么的？例如：一部科幻小说，讲述一个侦探在记忆可以交易的城市里破案的故事。',
      'generate_proposals': '生成方案',
      'proposals_title': '选择一个方案',
      'generating': '生成中...',
      'outline_summary': '大纲与摘要',
      'generate_outline': '生成大纲',
      'chapters': '章节',
      'generate_content': '生成内容',
      'generate_image': '生成配图',
      'delete_book': '删除书籍',
      'settings': '设置',
      'theme': '主题',
      'language': '语言',
      'light': '浅色',
      'dark': '深色',
      'system': '系统',
      'back': '返回',
      'save': '保存',
      'saved': '已保存',
      'no_books': '还没有书籍。开始你的第一部杰作吧！',
      'chapter_content_placeholder': '章节内容将显示在这里...',
      'book_idea': '书籍创意',
      'step_1': '第一步：创意',
      'step_2': '第二步：方案',
      'step_3': '第三步：大纲',
      'target_audience': '目标读者',
      'tone': '基调',
      'concept': '核心概念',
      'select': '选择',
      'creating_book': '正在创建你的书籍...',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
