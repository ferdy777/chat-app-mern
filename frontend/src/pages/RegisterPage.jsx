import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "../components/ThemeToggle";
import regBg from "../assets/reg.jpg";

const RegisterPage = () => {
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", inviteCode: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center px-4 pt-16 pb-4 sm:py-6 relative overflow-hidden bg-background">
      <div
        className="fixed inset-0 bg-no-repeat bg-center bg-[length:100%_100%] sm:bg-cover"
        style={{ backgroundImage: `url(${regBg})` }}
      />
      <div className="fixed inset-0 bg-black/60" />

      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-30 bg-background/90 backdrop-blur border border-border rounded-full p-1.5 sm:p-2 shadow-md">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm max-h-[80vh] sm:max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur border border-border rounded-xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col items-center mb-3">
          <MessageCircle className="text-primary w-8 h-8 sm:w-9 sm:h-9 mb-1" fill="currentColor" fillOpacity={0.15} />
          <h1 className="text-card-foreground text-lg sm:text-xl font-semibold">Create account</h1>
          <p className="text-muted-foreground text-xs">Start chatting in seconds</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1">
            <Label htmlFor="fullName" className="text-sm">Full name</Label>
            <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="username" className="text-sm">Username</Label>
            <Input id="username" name="username" value={form.username} onChange={handleChange} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-sm">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={handleChange}
                minLength={6}
                required
                className="pr-10"
              />
                            <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors rounded-full p-1 hover:bg-primary/10"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inviteCode" className="text-sm">Invite code</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              placeholder="Ask the app owner for this"
              value={form.inviteCode}
              onChange={handleChange}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <p className="text-muted-foreground text-xs text-center mt-3">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;