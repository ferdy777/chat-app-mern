import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "../components/ThemeToggle";
import GuestBotWidget from "../components/GuestBotWidget";
import loginBg from "../assets/login.jpg";

const LoginPage = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(emailOrUsername, password);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-background">
      <div
        className="absolute inset-0 bg-no-repeat bg-center bg-[length:100%_100%] sm:bg-cover"
        style={{ backgroundImage: `url(${loginBg})` }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 bg-background/90 backdrop-blur border border-border rounded-full p-1.5 sm:p-2 shadow-md">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm bg-card/95 backdrop-blur border border-border rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <MessageCircle className="text-primary w-12 h-12 mb-2" fill="currentColor" fillOpacity={0.15} />
          <h1 className="text-card-foreground text-2xl font-semibold">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Log in to keep chatting</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailOrUsername">Email or username</Label>
            <Input
              id="emailOrUsername"
              type="text"
              placeholder="you@example.com"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log in"}
          </Button>
        </form>
        <p className="text-muted-foreground text-sm text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>

      <GuestBotWidget />
    </div>
  );
};

export default LoginPage;