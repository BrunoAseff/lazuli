export const getDashboardGreeting = (name: string, hour: number) => {
  const firstName = name.trim().split(/\s+/u)[0];
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return firstName ? `${greeting}, ${firstName}` : "Olá";
};
