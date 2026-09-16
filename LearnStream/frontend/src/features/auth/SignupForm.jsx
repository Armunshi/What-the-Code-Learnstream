import { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import AuthContext from '@/contexts/AuthProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { normalizeApiError } from '@/lib/api/errors';
import { signupStep1Schema, otpSchema, PASSWORD_RULES } from './schemas.js';
import { signup, verifyRegistration, resendRegistration, checkEmailAvailable } from './api.js';

const EMAIL_CHECK_DEBOUNCE_MS = 500;

function useDebouncedEmailCheck(email, emailIsValid) {
  const [status, setStatus] = useState('idle'); // idle | checking | available | taken
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!emailIsValid) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const requestId = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const available = await checkEmailAvailable(email);
        if (requestIdRef.current !== requestId) return;
        setStatus(available ? 'available' : 'taken');
      } catch {
        if (requestIdRef.current !== requestId) return;
        setStatus('idle');
      }
    }, EMAIL_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [email, emailIsValid]);

  return status;
}

function StepOne({ role, verb, onSubmitted }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(signupStep1Schema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const password = watch('password') || '';
  const email = watch('email') || '';
  const emailFieldValid = !errors.email && email.length > 0;
  const emailStatus = useDebouncedEmailCheck(email, emailFieldValid);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const result = await signup(role, values);
      onSubmitted({ email: result.email, expiresAt: result.expiresAt, resendAvailableAt: result.resendAvailableAt });
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (normalized.errors.some((e) => e.code === 'EMAIL_EXISTS')) {
        toast.error('Account already exists. Log in instead?');
      } else {
        toast.error(normalized.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disableSubmit = !isValid || submitting || emailStatus === 'taken';

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} data-testid="signup-step-1">
      <h2 className="text-xl font-bold">Welcome to LearnStream</h2>
      <p className="text-sm text-gray-600">Register to start your {verb} journey</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register('firstName')} autoComplete="given-name" />
          {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register('lastName')} autoComplete="family-name" />
          {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} autoComplete="email" />
        {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
        {!errors.email && emailStatus === 'taken' && (
          <p className="text-xs text-red-600 mt-1" data-testid="email-exists-hint">
            Account already exists.{' '}
            <Link to="/login" className="underline">
              Log in instead?
            </Link>
          </p>
        )}
        {!errors.email && emailStatus === 'checking' && (
          <p className="text-xs text-gray-500 mt-1">Checking…</p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" {...register('password')} autoComplete="new-password" />
        <ul className="mt-1 space-y-0.5">
          {PASSWORD_RULES.map((rule) => {
            const passes = rule.test(password);
            return (
              <li key={rule.id} className={`flex items-center gap-1 text-xs ${passes ? 'text-green-600' : 'text-gray-500'}`}>
                {passes ? <Check size={12} /> : <X size={12} />}
                {rule.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" type="password" {...register('confirmPassword')} autoComplete="new-password" />
        {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Controller
          name="terms"
          control={control}
          render={({ field }) => (
            <Checkbox id="terms" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Label htmlFor="terms" className="text-sm font-normal">
          I agree with the{' '}
          <Link to="/terms" className="underline">
            terms and conditions
          </Link>
        </Label>
      </div>
      {errors.terms && <p className="text-xs text-red-600">{errors.terms.message}</p>}

      <Button type="submit" disabled={disableSubmit}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Create account'}
      </Button>

      <p className="text-sm text-gray-600 text-center">
        {role === 'student' ? (
          <>
            Signing up to teach instead?{' '}
            <Link to="/signup/teacher" className="underline">
              Sign up as a teacher
            </Link>
          </>
        ) : (
          <>
            Signing up to learn instead?{' '}
            <Link to="/signup/student" className="underline">
              Sign up as a student
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function useCountdown(targetTime) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, new Date(targetTime).getTime() - Date.now()));

  useEffect(() => {
    const target = new Date(targetTime).getTime();
    const tick = () => setRemainingMs(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  return remainingMs;
}

function StepTwo({ email, expiresAt, resendAvailableAt, onVerified }) {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({ resolver: zodResolver(otpSchema), mode: 'onChange', defaultValues: { code: '' } });

  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(resendAvailableAt);

  const expiryRemainingMs = useCountdown(expiresAt);
  const resendRemainingMs = useCountdown(cooldownUntil);

  const expiryMinutes = Math.floor(expiryRemainingMs / 60000);
  const expirySeconds = Math.floor((expiryRemainingMs % 60000) / 1000);
  const canResend = resendRemainingMs <= 0;

  const onSubmit = async ({ code }) => {
    setVerifying(true);
    try {
      const result = await verifyRegistration({ email, code });
      onVerified(result);
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast.error(normalized.message || 'Incorrect code');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      const result = await resendRegistration({ email });
      setCooldownUntil(result.resendAvailableAt);
      toast.success('A new code has been sent');
    } catch (err) {
      toast.error(normalizeApiError(err).message);
    } finally {
      setResending(false);
    }
  }, [email]);

  return (
    <form className="flex flex-col gap-4 items-center" onSubmit={handleSubmit(onSubmit)} data-testid="signup-step-2">
      <h2 className="text-xl font-bold">Check your email</h2>
      <p className="text-sm text-gray-600 text-center">
        We sent a 6-digit code to <strong>{email}</strong>
      </p>

      <Controller
        name="code"
        control={control}
        render={({ field }) => (
          <InputOTP maxLength={6} value={field.value} onChange={field.onChange} data-testid="otp-input">
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        )}
      />
      {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}

      {expiryRemainingMs > 0 ? (
        <p className="text-xs text-gray-500" data-testid="otp-countdown">
          Code expires in {expiryMinutes}:{String(expirySeconds).padStart(2, '0')}
        </p>
      ) : (
        <p className="text-xs text-red-600" data-testid="otp-countdown">
          Code expired — request a new one below
        </p>
      )}

      <Button type="submit" disabled={!isValid || verifying} className="w-full">
        {verifying ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!canResend || resending}
        onClick={handleResend}
        data-testid="resend-button"
      >
        {resending
          ? 'Sending…'
          : canResend
            ? 'Resend code'
            : `Resend available in ${Math.ceil(resendRemainingMs / 1000)}s`}
      </Button>
    </form>
  );
}

// The public, plan-defined two-step SignupPage (S-FR-1.2/S-FR-2.1):
// Step 1 collects and validates the account, Step 2 verifies the emailed
// OTP. `role` and `verb` keep the same prop contract components/Signup.jsx
// already had, so Signup-students.jsx/Signup-Teacher.jsx need no changes.
export function SignupForm({ role, verb = 'amazing' }) {
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(null);
  const { setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleVerified = ({ user, role: userRole, accessToken }) => {
    setAuth({ user_id: user._id, name: user.name, role: userRole, accessToken });
    localStorage.setItem('userMeta', JSON.stringify({ user_id: user._id, name: user.name, role: userRole }));
    // Onboarding is offered once, right after signup, never forced
    // elsewhere in the app (plan: "Both have an equally prominent 'Skip for
    // now'. Onboarding is offered once, never forced.").
    navigate('/onboarding/phone');
  };

  if (step === 2 && pending) {
    return (
      <StepTwo
        email={pending.email}
        expiresAt={pending.expiresAt}
        resendAvailableAt={pending.resendAvailableAt}
        onVerified={handleVerified}
      />
    );
  }

  return (
    <StepOne
      role={role}
      verb={verb}
      onSubmitted={(result) => {
        setPending(result);
        setStep(2);
      }}
    />
  );
}

export default SignupForm;
