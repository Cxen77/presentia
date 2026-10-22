# Class Attendance Mobile Application

A production-grade React Native & Expo application strictly recreating the visual design, typography, card surfaces, and color palette from the reference screenshots.

---

## 📱 Visual Reference Mapping

### 1. Onboarding / Welcome Screen (Reference 1, Screen 1)
- **Headline**: "Class Attendance" in bold white, "Simplified." in pale accent blue (`#9AB9EC`).
- **Tagline**: "Scan • Attend • Stay in Track" in muted blue-gray (`#7F94B0`).
- **Illustration**: 3D tilted dark smartphone with high-contrast QR display, angled slate slabs behind, and a circular pale-blue checkmark badge (`#85A9E6`) at the bottom-right corner.
- **Features**:
  1. Quick Attendance ("Scan QR and mark instantly")
  2. Track Progress ("Stay updated with your classes")
  3. Your Academic Companion ("Simple. Fast. Reliable.")
- **Bottom Action**: Wide off-white pill button (`#F3F2EF`) with dark navy label "Get Started →".

### 2. Student Login Screen (Reference 1, Screen 2)
- **Header**: "Welcome Back", "Login to your account", and thin pale-blue left back arrow.
- **Graduation Cap Tile**: Rounded square tile (`#1E3E61` to `#112437` gradient) with white academic cap icon.
- **Inputs**: Rounded dark containers (`#102235`, radius 22px):
  - Roll Number with user icon (default: `CS24123`).
  - Password with lock icon and visibility toggle.
- **Controls**: "Remember me" checkbox with pale blue fill + dark checkmark; "Forgot password?" link.
- **Login Action**: "Login →" off-white pill button.
- **Divider**: "or" with subtle horizontal divider lines.
- **Alternative**: "Login with QR Code" rounded button with QR icon & right chevron.
- **Footer**: "New here? Contact your admin".

### 3. Login with QR Screen (Reference 1, Screen 3)
- **Header**: "Login with QR", "Scan the code provided by your institution".
- **Illustration Panel**: Large rounded dark panel (`#0C1E30`, radius 30px) featuring the tilted phone displaying a QR code framed by 4 bright corner scanning brackets (`#9AB9EC`).
- **Interactive Scanner**: Tap to simulate or trigger live verification.
- **Info Banner**: Circular pale-blue info icon + "Make sure you are connected to your college network".

### 4. Student Home Dashboard (Reference 2)
- **Header**: "Hello,", "Aryan" (38px bold white), "Let's make today count", and notification bell with indicator dot.
- **Dominant Profile & Statistics Card**:
  - Off-white card surface (`#F3F2EF`, radius 32px) with delicate pale-blue organic waves.
  - Circular avatar (Aryan Sharma portrait) with pale-blue outer ring & circular edit pencil badge.
  - "Aryan Sharma", "B.Tech Computer Science", "Roll No: CS24123", "3rd Semester" badge with graduation cap.
  - Lower 3-column statistics strip:
    - **86%** Attendance (Bar chart icon)
    - **12** Total Classes (Book icon)
    - **10** Present Today (Clock icon)
- **Today's Classes Section**:
  - Header: "Today's Classes" + "Today ▾" dropdown selector.
  - **Class 1 (Data Structures)**: Highlighted navy card (`#203954`), monitor icon in slate tile (`#2D4C6E`), "Mark Attendance" button.
  - **Class 2 (Database Management)**: Charcoal card (`#202D39`), open book icon in tile (`#2B3B4A`), "Not Started" badge.
  - **Class 3 (Operating Systems)**: Charcoal card (`#202D39`), users icon in tile (`#2B3B4A`), "Not Started" badge.
  - **Class 4 (Computer Networks)**: Charcoal card (`#202D39`), analytics chart icon in tile (`#2B3B4A`), "Not Started" badge.
- **Bottom Navigation**: 4 persistent tabs:
  - **Home**: Active state is an off-white rounded capsule with dark navy home icon & label.
  - **My Classes**: Timetable & courses.
  - **Attendance**: Subject breakdown & exam eligibility (≥75%).
  - **Profile**: Student records & settings.

---

## 🛠️ Architecture & Tech Stack

- **Framework**: React Native with Expo SDK 58
- **TypeScript**: Strict types across all components and models
- **Styling**: Pure React Native StyleSheet with central design tokens (`src/theme/colors.ts`, `src/theme/typography.ts`, `src/theme/spacing.ts`)
- **Vectors & Shapes**: `react-native-svg` for curved organic blobs, angled phone illustrations, and scanner reticles
- **Icons**: `lucide-react-native`
- **Backend**: Supabase with client fallback (`src/services/supabase.ts`, `supabase/schema.sql`)
- **Faculty Companion**: Built-in Faculty Desk companion portal to start attendance sessions, show classroom QR code with countdown, and view real-time attendees.

---

## 🚀 Running the Project

1. Navigate to the project folder:
   ```bash
   cd C:\Users\Dev\.gemini\antigravity-ide\scratch\class-attendance-app
   ```

2. Run on Web:
   ```bash
   npm run web
   # or
   npx expo start --web --port 8081
   ```
   Open `http://localhost:8081` in any browser.

3. Run on Mobile (iOS / Android with Expo Go):
   ```bash
   npx expo start
   ```
   Scan the terminal QR code using Expo Go on your mobile device.

---

## 🗄️ Supabase Database Setup

1. Open your Supabase SQL Editor.
2. Execute `supabase/schema.sql` to establish base tables (`profiles`, `classes`, `class_enrollments`, `class_invitations`).
3. Execute `supabase/migration_001_attendance.sql` to apply the attendance system:
   - Extends `classes` with faculty ownership (`faculty_id`)
   - Creates `attendance_sessions`, `qr_tokens`, and `attendance_records`
   - Configures strict Row-Level Security (RLS) policies
   - Enables Supabase Realtime publication on `attendance_records`

---

## 🔐 Google OAuth Configuration

1. In Google Cloud Console:
   - Create an OAuth 2.0 Client ID for Web Application.
   - Authorized redirect URIs:
     - `https://<YOUR-SUPABASE-PROJECT-ID>.supabase.co/auth/v1/callback`
2. In Supabase Dashboard:
   - Go to **Authentication** > **Providers** > **Google**.
   - Enable Google, enter Client ID and Client Secret.
3. In Supabase URL Configuration:
   - Site URL: `https://your-faculty-portal.vercel.app` (or `http://localhost:5173` for development)
   - Redirect URLs:
     - `http://localhost:5173/**`
     - `https://your-faculty-portal.vercel.app/**`
     - `classattendance://**` (for the Student Mobile App)

---

## 🚀 Running the Services Locally

### 1. Backend Server (`/backend`)
```bash
cd backend
npm install
npm run dev      # Runs on http://localhost:4000
```

### 2. Faculty Web Portal (`/faculty-portal`)
```bash
cd faculty-portal
npm install
npm run dev      # Runs on http://localhost:5173
```

### 3. Student Mobile App (`/`)
```bash
npm install
npx expo start   # Web: press 'w', or scan QR in Expo Go
```

---

## ☁️ Production Deployment on Render

The repository includes a ready-to-use `render.yaml` blueprint.

1. Push your repository to GitHub.
2. In Render Dashboard, click **New +** > **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml` and provisions:
   - Service: `class-attendance-backend` (Node.js web service)
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Health Check: `/health`
4. Set the secret environment variables in the Render dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `ALLOWED_ORIGINS` (your faculty portal URL + student app origins)

