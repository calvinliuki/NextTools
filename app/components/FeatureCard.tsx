interface FeatureCardProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, iconColor, title, description }: FeatureCardProps) {
  return (
    <div className="text-center p-6">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-lg ${iconColor} bg-opacity-10 flex items-center justify-center`}>
        <i className={`fas ${icon} text-2xl ${iconColor}`}></i>
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  );
}
