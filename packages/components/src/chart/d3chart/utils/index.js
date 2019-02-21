/** @format */

/**
 * External dependencies
 */
import { isNil } from 'lodash';
import { format as d3Format } from 'd3-format';
import { utcParse as d3UTCParse } from 'd3-time-format';

/**
 * Allows an overriding formatter or defaults to d3Format or d3TimeFormat
 * @param {string|function} format - either a format string for the D3 formatters or an overriding fomatting method
 * @param {function} formatter - default d3Format or another formatting method, which accepts the string `format`
 * @returns {function} to be used to format an input given the format and formatter
 */
export const getFormatter = ( format, formatter = d3Format ) =>
	typeof format === 'function' ? format : formatter( format );

/**
 * Describes `getOrderedKeys`
 * @param {array} data - The chart component's `data` prop.
 * @returns {array} of unique category keys ordered by cumulative total value
 */
export const getOrderedKeys = ( data ) => {
	const keys = new Set(
		data.reduce( ( acc, curr ) => acc.concat( Object.keys( curr ) ), [] )
	);

	return [ ...keys ]
		.filter( key => key !== 'date' )
		.map( key => ( {
			key,
			focus: true,
			total: data.reduce( ( a, c ) => a + c[ key ].value, 0 ),
			visible: true,
		} ) )
		.sort( ( a, b ) => b.total - a.total );
};

/**
 * Describes `getUniqueDates`
 * @param {array} data - the chart component's `data` prop.
 * @param {string} dateParser - D3 time format
 * @returns {array} an array of unique date values sorted from earliest to latest
 */
export const getUniqueDates = ( data, dateParser ) => {
	const parseDate = d3UTCParse( dateParser );
	const dates = new Set(
		data.map( d => d.date )
	);
	return [ ...dates ].sort( ( a, b ) => parseDate( a ) - parseDate( b ) );
};

/**
 * Check whether data is empty.
 * @param {array} data - the chart component's `data` prop.
 * @param {number} baseValue - base value to test data values against.
 * @returns {boolean} `false` if there was at least one data value different than
 * the baseValue.
 */
export const isDataEmpty = ( data, baseValue = 0 ) => {
	for ( let i = 0; i < data.length; i++ ) {
		for ( const [ key, item ] of Object.entries( data[ i ] ) ) {
			if ( key !== 'date' && ! isNil( item.value ) && item.value !== baseValue ) {
				return false;
			}
		}
	}

	return true;
};
