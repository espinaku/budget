function Button({ children, type = 'button', variant = 'primary', size = 'md', disabled, onClick, className, ...rest }) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className].filter(Boolean).join(' ');
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes} {...rest}>
      {children}
    </button>
  );
}

export default Button;
