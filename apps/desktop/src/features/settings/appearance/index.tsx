import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  return (
    <ContentSection
      title='外观'
      desc='调整应用主题、字体和界面方向。'
    >
      <AppearanceForm />
    </ContentSection>
  )
}
