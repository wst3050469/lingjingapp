export type EffectLevel = 'full' | 'reduced' | 'minimal'

export interface HeroConfig {
  title: string
  subtitle: string
  description: string
  ctaButtons: CtaButton[]
}

export interface CtaButton {
  label: string
  href: string
  variant: 'primary' | 'secondary' | 'outline'
}

export interface FeatureItem {
  icon: string
  title: string
  description: string
  tag?: string
}

export interface TechArchItem {
  icon: string
  title: string
  description: string
  techs: string[]
}

export interface StepItem {
  step: number
  title: string
  description: string
  code?: string
}

export interface TestimonialItem {
  quote: string
  author: string
  role: string
  avatar?: string
}

export interface StatItem {
  value: string
  label: string
  suffix?: string
}

export interface DeviceInfo {
  effectLevel: EffectLevel
  isMobile: boolean
  isTablet: boolean
  screenWidth: number
}