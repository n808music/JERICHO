import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const baseClasses = 'tf-btn';
  const variantClasses = `tf-btn--${variant}`;
  const sizeClasses = `tf-btn--${size}`;
  const stateClasses = disabled ? 'tf-btn--disabled' : '';
  const loadingClasses = loading ? 'tf-btn--loading' : '';

  const buttonClasses = [
    baseClasses,
    variantClasses,
    sizeClasses,
    stateClasses,
    loadingClasses,
    className
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (e) => {
    if (disabled || loading) return;
    onClick?.(e);
  };

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-describedby={loading ? 'loading-text' : undefined}
      {...props}
    >
      {loading && (
        <span className="sr-only" id="loading-text">
          Loading
        </span>
      )}
      {children}
    </button>
  );
};

export default Button;
