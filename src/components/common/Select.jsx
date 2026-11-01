function Select({options = [], className, placeholder, ...rest}) {
  return (
    <select className={`input select ${className ?? ''}`} {...rest}>
      {placeholder && <option value="" disabled hidden>{placeholder}</option>}
      {options.map(({ value, label}) => (
          <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

export default Select;