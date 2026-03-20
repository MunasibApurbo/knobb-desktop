import { useEffect, useRef, useState } from "react";
import { LandingMenu } from "./LandingMenu";
import {
  scheduleBackgroundTask,
  useLowEndDevice,
  usePrefersReducedMotion,
} from "@/lib/performanceProfile";
import { playLandingTransition } from "./intro";

// Import styles
import "./css/transition.css";
import "./css/globals.css";
import "./css/menu.css";
import "./css/contact.css";
import "./css/footer.css";

export default function LandingContactPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const lowEndDevice = useLowEndDevice();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const stopIntro = playLandingTransition(container, { lowEndDevice, prefersReducedMotion });
    const shouldLoadInteractiveDesktopMotion =
      !prefersReducedMotion && !lowEndDevice && window.innerWidth > 1000;

    if (!shouldLoadInteractiveDesktopMotion) {
      return stopIntro;
    }

    let active = true;
    let cleanup = () => undefined;
    const cancelScheduledTask = scheduleBackgroundTask(() => {
      void import("./useContactAnimations").then(({ startContactAnimations }) => {
        if (!active || !containerRef.current) return;
        cleanup = startContactAnimations(containerRef.current, {
          lowEndDevice,
          prefersReducedMotion,
        });
      });
    }, 450);

    return () => {
      active = false;
      cancelScheduledTask();
      cleanup();
      stopIntro();
    };
  }, [lowEndDevice, prefersReducedMotion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    // Simulate API call
    setTimeout(() => {
      setIsSending(false);
      setIsSubmitted(true);
      setTimeout(() => setIsSubmitted(false), 5000);
    }, 1500);
  };

  return (
    <div className="page contact-page landing-wrapper" ref={containerRef}>
      <LandingMenu />

      {/* Transition Overlay */}
      <div className="transition">
        <div className="transition-overlay overlay-1"></div>
        <div className="transition-overlay overlay-2"></div>
        <div className="transition-overlay overlay-3"></div>
        <div className="transition-overlay overlay-4"></div>
        <div className="transition-overlay overlay-5"></div>
      </div>

      <section className="contact trail-container">
        <div className="floating-elements"></div>
        <div className="contact-left">
          <div className="contact-card-header-main">
            <h1>Let's Connect</h1>
            <p>
              Got a project idea? Need a stunning website or a robust app? Or just want to geek out over code and design? I'm all in. Drop me a line, and let's create something extraordinary together.
            </p>
          </div>
          <div className="contact-info">
            <div className="contact-info-item">
              <p className="label">Project Inquiries</p>
              <p><a href="mailto:hello@knobb.app" target="_blank" rel="noopener noreferrer">hello@knobb.app</a></p>
            </div>
            <div className="contact-info-item">
              <p className="label">Social</p>
              <p><a href="https://x.com/knobb_music" target="_blank" rel="noopener noreferrer">@knobb_music</a></p>
            </div>
          </div>
        </div>

        <div className="contact-form-container">
          <div className="form-header">
            <h2>Start a Project</h2>
            <p>Tell me about your vision and let's make it reality</p>
          </div>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <input type="text" id="firstName" name="firstName" placeholder="Your first name" required />
                <label htmlFor="firstName">First Name</label>
              </div>
              <div className="form-group">
                <input type="text" id="lastName" name="lastName" placeholder="Your last name" required />
                <label htmlFor="lastName">Last Name</label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input type="email" id="email" name="email" placeholder="your@email.com" required />
                <label htmlFor="email">Email Address</label>
              </div>
              <div className="form-group">
                <input type="tel" id="phone" name="phone" placeholder="+1 (555) 123-4567" />
                <label htmlFor="phone">Phone Number</label>
              </div>
            </div>
            <div className="form-group full-width">
              <select id="projectType" name="projectType" required defaultValue="">
                <option value="" disabled>Select project type</option>
                <option value="website">Website Development</option>
                <option value="webapp">Web Application</option>
                <option value="desktopapp">Desktop Application</option>
                <option value="ecommerce">E-commerce Platform</option>
                <option value="redesign">Website Redesign</option>
                <option value="consultation">Consultation</option>
                <option value="other">Other</option>
              </select>
              <label htmlFor="projectType">Project Type</label>
            </div>
            <div className="form-group full-width">
              <textarea id="message" name="message" placeholder="Tell me about your project, goals, timeline, and budget..." required></textarea>
              <label htmlFor="message">Project Details</label>
            </div>
            <button type="submit" className="submit-btn" disabled={isSending}>
              {isSending ? "Sending..." : "Send Message"}
            </button>
            <div className={`success-message ${isSubmitted ? 'show' : ''}`}>
              <p>Thanks! Your message has been sent. I'll get back to you within 24 hours.</p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
