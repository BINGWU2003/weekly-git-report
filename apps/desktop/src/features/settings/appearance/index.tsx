import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  return (
    <ContentSection
      title='界面偏好'
      desc='选择应用使用的字体和显示主题。'
    >
      <AppearanceForm />
    </ContentSection>
  )
}
