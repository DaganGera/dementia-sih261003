import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowRight, Globe } from 'lucide-react'
import { Instagram, Twitter } from '../components/SocialIcons'
import AboutSection from '../components/AboutSection'
import FeaturedVideoSection from '../components/FeaturedVideoSection'
import PhilosophySection from '../components/PhilosophySection'
import ServicesSection from '../components/ServicesSection'

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4'

const FADE_MS = 500
const FADE_OUT_REMAINING_S = 0.55
const LOOP_RESTART_DELAY_MS = 100

const NAV_LINKS = ['Features', 'Pricing', 'About']

// Fades the hero video in and out with requestAnimationFrame so the loop crossfades through black.
function useLoopingFade(videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let frame = 0
    let restartTimer = 0
    let fadingOut = false

    const cancelFade = () => cancelAnimationFrame(frame)

    const fadeTo = (target: number) => {
      cancelFade()
      const from = parseFloat(video.style.opacity || '0')
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - start) / FADE_MS, 1)
        video.style.opacity = String(from + (target - from) * t)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    const fadeIn = () => {
      fadingOut = false
      fadeTo(1)
    }

    const onCanPlay = () => {
      void video.play().catch(() => {})
      if (!fadingOut) fadeIn()
    }

    const onTimeUpdate = () => {
      if (fadingOut || !Number.isFinite(video.duration)) return
      if (video.duration - video.currentTime <= FADE_OUT_REMAINING_S) {
        fadingOut = true
        fadeTo(0)
      }
    }

    const onEnded = () => {
      cancelFade()
      video.style.opacity = '0'
      restartTimer = window.setTimeout(() => {
        video.currentTime = 0
        void video.play().catch(() => {})
        fadeIn()
      }, LOOP_RESTART_DELAY_MS)
    }

    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)

    return () => {
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
      cancelFade()
      window.clearTimeout(restartTimer)
    }
  }, [videoRef])
}

export default function Index() {
  const videoRef = useRef<HTMLVideoElement>(null)
  useLoopingFade(videoRef)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  return (
    <div className="bg-black">
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <video
          ref={videoRef}
          src={HERO_VIDEO}
          muted
          autoPlay
          playsInline
          preload="auto"
          aria-hidden="true"
          style={{ opacity: 0 }}
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />

        <nav className="relative z-20 px-6 py-6">
          <div className="liquid-glass mx-auto flex max-w-5xl items-center justify-between rounded-full px-6 py-3">
            <div className="flex items-center">
              <div className="flex items-center gap-2">
                <Globe size={24} className="text-white" />
                <span className="text-lg font-semibold text-white">Asme</span>
              </div>
              <div className="ml-8 hidden items-center gap-8 md:flex">
                {NAV_LINKS.map((label) => (
                  <a
                    key={label}
                    href="#"
                    className="text-sm font-medium text-white/80 hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button type="button" className="text-sm font-medium text-white">
                Sign Up
              </button>
              <button
                type="button"
                className="liquid-glass rounded-full px-6 py-2 text-sm font-medium text-white"
              >
                Login
              </button>
            </div>
          </div>
        </nav>

        <div className="relative z-10 flex flex-1 -translate-y-[20%] flex-col items-center justify-center px-6 py-12 text-center">
          <h1 className="mb-8 font-serif text-7xl tracking-tight text-white whitespace-nowrap md:text-8xl lg:text-9xl">
            Know it <em className="italic">all</em>.
          </h1>

          <form onSubmit={handleSubmit} className="mb-6 w-full max-w-xl">
            <div className="liquid-glass flex items-center gap-3 rounded-full py-2 pl-6 pr-2">
              <input
                type="email"
                required
                aria-label="Email address"
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="rounded-full bg-white p-3 text-black"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </form>

          <p className="mb-6 px-4 text-sm leading-relaxed text-white">
            Stay updated with the latest news and insights. Subscribe to our newsletter today and
            never miss out on exciting updates.
          </p>

          <button
            type="button"
            className="liquid-glass rounded-full px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            Manifesto
          </button>
        </div>

        <div className="relative z-10 flex justify-center gap-4 pb-12">
          {[
            { label: 'Instagram', Icon: Instagram },
            { label: 'Twitter', Icon: Twitter },
            { label: 'Website', Icon: Globe },
          ].map(({ label, Icon }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white"
            >
              <Icon size={20} />
            </a>
          ))}
        </div>
      </section>

      <AboutSection />
      <FeaturedVideoSection />
      <PhilosophySection />
      <ServicesSection />
    </div>
  )
}
