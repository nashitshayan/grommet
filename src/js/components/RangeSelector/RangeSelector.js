import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import styled, { ThemeContext } from 'styled-components';

import { Box } from '../Box';
import { EdgeControl } from './EdgeControl';
import { parseMetricToNum } from '../../utils';
import { MessageContext } from '../../contexts/MessageContext';
import { RangeSelectorPropTypes } from './propTypes';

const Container = styled(Box)`
  user-select: none;
`;

const RangeSelector = forwardRef(
  (
    {
      color,
      direction = 'horizontal',
      invert,
      max = 100,
      messages,
      min = 0,
      onChange,
      opacity = 'medium',
      round,
      size = 'medium',
      step = 1,
      values = [],
      ...rest
    },
    ref,
  ) => {
    const theme = useContext(ThemeContext) || defaultProps.theme;
    const { format } = useContext(MessageContext);
    const [changing, setChanging] = useState();
    const [lastChange, setLastChange] = useState();
    const [moveValue, setMoveValue] = useState();
    const containerRef = useRef();

    const valueForMouseCoord = useCallback(
      (event) => {
        const rect = containerRef.current.getBoundingClientRect();
        let value;
        if (direction === 'vertical') {
          // there is no x and y in unit testing
          const y = event.clientY - (rect.top || 0); // test resilience
          const scaleY = rect.height / (max - min + 1) || 1; // test resilience
          value = Math.floor(y / scaleY) + min;
        } else {
          const x = event.clientX - (rect.left || 0); // test resilience
          const scaleX = rect.width / (max - min + 1) || 1; // test resilience
          value = Math.floor(x / scaleX) + min;
        }
        // align with closest step within [min, max]
        const result = Math.ceil(value / step) * step;
        if (result < min) {
          return min;
        }
        if (result > max) {
          return max;
        }
        return result;
      },
      [direction, max, min, step],
    );

    const onMouseMove = useCallback(
      (event) => {
        const value = valueForMouseCoord(event);
        let nextValues;
        if (changing === 'lower' && value <= values[1] && value !== moveValue) {
          nextValues = [value, values[1]];
        } else if (
          changing === 'upper' &&
          value >= values[0] &&
          value !== moveValue
        ) {
          nextValues = [values[0], value];
        } else if (changing === 'selection' && value !== moveValue) {
          if (value === max) {
            nextValues = [max - (values[1] - values[0]), max];
          } else if (value === min) {
            nextValues = [min, min + (values[1] - values[0])];
          } else {
            const delta = value - moveValue;
            if (values[0] + delta >= min && values[1] + delta <= max) {
              nextValues = [values[0] + delta, values[1] + delta];
            }
          }
        }
        if (nextValues) {
          setMoveValue(value);
          onChange(nextValues);
        }
      },
      [
        values,
        changing,
        moveValue,
        max,
        min,
        setMoveValue,
        onChange,
        valueForMouseCoord,
      ],
    );

    useEffect(() => {
      const onMouseUp = () => setChanging(undefined);

      if (changing) {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
      }
      return undefined;
    }, [changing, onMouseMove]);

    const onClick = useCallback(
      (event) => {
        const value = valueForMouseCoord(event);
        if (
          value <= values[0] ||
          (value < values[1] && lastChange === 'lower')
        ) {
          setLastChange('lower');
          onChange([value, values[1]]);
        } else if (
          value >= values[1] ||
          (value > values[0] && lastChange === 'upper')
        ) {
          setLastChange('upper');
          onChange([values[0], value]);
        }
      },
      [lastChange, onChange, valueForMouseCoord, values],
    );

    const onTouchMove = useCallback(
      (event) => {
        const touchEvent = event.changedTouches[0];
        onMouseMove(touchEvent);
      },
      [onMouseMove],
    );

    const [lower, upper] = values;
    // It needs to be true when vertical, due to how browsers manage height
    // const fill = direction === 'vertical' ? true : 'horizontal';
    const thickness =
      size === 'full'
        ? undefined
        : `${parseMetricToNum(theme.global.edgeSize[size] || size)}px`;
    const layoutProps = { fill: direction, round };
    if (direction === 'vertical') layoutProps.width = thickness;
    else layoutProps.height = thickness;
    if (size === 'full') layoutProps.alignSelf = 'stretch';

    return (
      <Container
        ref={containerRef}
        direction={direction === 'vertical' ? 'column' : 'row'}
        align="center"
        fill
        {...rest}
        tabIndex="-1"
        onClick={onChange ? onClick : undefined}
        onTouchMove={onChange ? onTouchMove : undefined}
      >
        <Box
          style={{ flex: `${lower - min} 0 0` }}
          background={
            invert
              ? // preserve existing dark, instead of using darknes
                // of this color
                {
                  color: color || theme.rangeSelector.background.invert.color,
                  opacity,
                  dark: theme.dark,
                }
              : undefined
          }
          {...layoutProps}
        />
        <EdgeControl
          a11yTitle={format({ id: 'rangeSelector.lower', messages })}
          role="slider"
          aria-valuenow={lower}
          aria-valuemin={min}
          aria-valuemax={max}
          tabIndex={0}
          ref={ref}
          color={color}
          direction={direction}
          thickness={thickness}
          edge="lower"
          onMouseDown={onChange ? () => setChanging('lower') : undefined}
          onTouchStart={onChange ? () => setChanging('lower') : undefined}
          onDecrease={
            onChange && lower - step >= min
              ? () => onChange([lower - step, upper])
              : undefined
          }
          onIncrease={
            onChange && lower + step <= upper
              ? () => onChange([lower + step, upper])
              : undefined
          }
        />
        <Box
          style={{
            flex: `${upper - lower + 1} 0 0`,
            cursor: direction === 'vertical' ? 'ns-resize' : 'ew-resize',
          }}
          background={
            invert
              ? undefined
              : // preserve existing dark, instead of using darknes of
                // this color
                { color: color || 'control', opacity, dark: theme.dark }
          }
          {...layoutProps}
          onMouseDown={
            onChange
              ? (event) => {
                  const nextMoveValue = valueForMouseCoord(event);
                  setChanging('selection');
                  setMoveValue(nextMoveValue);
                }
              : undefined
          }
        />
        <EdgeControl
          a11yTitle={format({ id: 'rangeSelector.upper', messages })}
          role="slider"
          aria-valuenow={upper}
          aria-valuemin={min}
          aria-valuemax={max}
          tabIndex={0}
          color={color}
          direction={direction}
          thickness={thickness}
          edge="upper"
          onMouseDown={onChange ? () => setChanging('upper') : undefined}
          onTouchStart={onChange ? () => setChanging('upper') : undefined}
          onDecrease={
            onChange && upper - step >= lower
              ? () => onChange([lower, upper - step])
              : undefined
          }
          onIncrease={
            onChange && upper + step <= max
              ? () => onChange([lower, upper + step])
              : undefined
          }
        />
        <Box
          style={{ flex: `${max - upper} 0 0` }}
          background={
            invert
              ? // preserve existing dark, instead of using darknes of this
                // color
                {
                  color: color || theme.rangeSelector.background.invert.color,
                  opacity,
                  dark: theme.dark,
                }
              : undefined
          }
          {...layoutProps}
          round={round}
        />
      </Container>
    );
  },
);

RangeSelector.displayName = 'RangeSelector';
RangeSelector.propTypes = RangeSelectorPropTypes;

export { RangeSelector };
