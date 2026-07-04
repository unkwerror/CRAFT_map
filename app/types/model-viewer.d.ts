import type * as React from 'react'

// JSX-типы для веб-компонента <model-viewer> (@google/model-viewer)
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          alt?: string
          poster?: string
          'camera-controls'?: boolean
          'auto-rotate'?: boolean
          'auto-rotate-delay'?: number | string
          'rotation-per-second'?: string
          'shadow-intensity'?: number | string
          'environment-image'?: string
          exposure?: number | string
          'camera-orbit'?: string
          'interaction-prompt'?: string
          'touch-action'?: string
          reveal?: string
          loading?: string
        },
        HTMLElement
      >
    }
  }
}
