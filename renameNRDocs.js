const fs = require('fs');
const { execSync } = require('child_process');

let PROCESS_MULTIPLE = false;
let fn = 'documents.csv';
if (process.argv.length >2) {
	fn = process.argv[2];
}

let docsCSV = fs.readFileSync(fn,{encoding: 'UTF-8'});
//docsCSV += docsCSV;

const dequote = (item, nospace) => {
	item += "";
	item = item.replace(/^"/,'');
	item = item.replace(/"\s*$/,'');
	if (nospace !== 'NO_SPACE') {
		item = item.replace(/'"/g,'');
		item = item.replace(/&/g,'and');
		item = item.replace(/[<>\?\/\s]+/g,'-');
		item = item.replace(/-+/g,'-');
	}
	else {
		item = item.replace(/\//g,'_');
	}
	return item;
}

const datify = (item) => {
	elems = (''+item).split('/');
	if (elems && elems.length >2) {
		return elems[2]+elems[0]+elems[1];
	}
	return "";
}

const raw = (item,name) => {
	let elem = item[headers[name]];
	return dequote(elem,'NO_SPACE');
}

const monthMap = [
	'',
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];
const dateToString = (date) => {
	// take either 'raw' or 'underscored' date
	date = date.replace(/(\d\d)[/_](\d\d)[/_](\d\d\d\d)/, (match, p1,p2,p3) => {
		let stringDate = monthMap[p1-0] + ' '+
			p2+', '+
			p3;
		return stringDate;
	});
	return date;
}



const getOldFile = (row) => {
	if (headers.hasOwnProperty('Vendor')) {
		// Receipt - Vendor - Amount - Payment Type
		// Receipt - Vendor - Payment Type - Category
		// Receipt - Vendor - Category - Date
		// Receipt - Vendor - Amount - Category
		// Receipt - Vendor - Payment Type - Date
		// Receipt - Amount - Payment Type - Category
		// Receipt - Amount - Category - Date
		let fields = ['Vendor', 'Amount', 'Payment Type', 'Category', 'Receipt Date'];
		let foundItems = [];
		fields.forEach((field) => {
			let val = raw(row,field);
			if (field === 'Amount') {
				val = (val == 0) ? "" : '$'+val;
			}
			if (field === 'Receipt Date') {
				val = dateToString(val);
			}
			if (val) {
				val = val.replace(/\s+$/, '');
				foundItems.push(val);
			}
		});
		foundItems.push('*');
		let fname = 'Receipt - '+
			foundItems[0]+' - '+
			foundItems[1]+' - '+
			foundItems[2]+'.pdf';

		return fname;
	}
	else {
		return 'Document - '+
			raw(row, 'Document Title')+' - '+
			'Created*.pdf';
	}
}

let names = {};
let curnames = {};

docsArr = CSVToArray(docsCSV);
let header = docsArr.shift();
let headers = {};
for (let i=0; i<header.length;i++) {
	headers[header[i]] = i;
}

docsArr.forEach((en) => {
	let oldfile = getOldFile(en);
	names[oldfile] = names[oldfile] ? names[oldfile]+1 : 1;

});
docsArr = docsArr.map((en) => {
	
	let title = dequote(en[headers['Document Title']]);
	let cat = dequote(en[headers['Category']]);
	let docdate = datify(en[headers['Document Date']]);
	let recdate = datify(en[headers['Receipt Date']]);
	let vendor = dequote(en[headers['Vendor']]);
	let doctype = dequote(en[headers['Document Type']]);
	let actiontype = dequote(en[headers['Action Type']]);
	let paymenttype = dequote(en[headers['Payment Type']]);
	let amount = dequote(en[headers['Amount']]);
	let tax = dequote(en[headers['Tax Category']]);
	if (tax === 'No-Form::Non-deductible') {
		tax = '';
	}
	else {
		tax = tax.replace(/::/,'~');
	}
	let comment = dequote(en[headers['Comments']]);
	comment = comment.replace(/-*Comment-*/,'');

	let filename;
	if (headers.hasOwnProperty('Vendor')) {
		filename = recdate+'_'+vendor+'_'+cat+'_'+amount+'_'+comment+'_'+tax+'.pdf';
	}
	else {
		filename = docdate+'_'+title+'_'+cat+'_'+doctype+'_'+actiontype+'_'+comment+'_'+tax+'.pdf';
	}


	let oldfilename = getOldFile(en);
	
	if (names[oldfilename] > 1) {
			curnames[oldfilename] = curnames[oldfilename] ? curnames[oldfilename]+1 : 1;
			console.log("multiple:", oldfilename, curnames[oldfilename], names[oldfilename]);
			if (curnames[oldfilename] > 1) {
				let index = curnames[oldfilename] -1;
				oldfilename = oldfilename.replace(/\.pdf$/,'_'+index+'.pdf');
			}
	}
	try {
		if (PROCESS_MULTIPLE || names[oldfilename] === 1) {
			oldfilename = oldfilename.replace(/[\s'"&:$]/g,'?');
			execSync("echo '"+oldfilename+" "+filename+"' >>log.txt");
			// Don't overwrite existing name (not POSIX...)
			execSync("mv -n "+oldfilename+" "+filename);
		}
		// difficult to determine order of multiple files.
		else {
			oldfilename = oldfilename.replace(/[\s'"&:$]/g,'?');
			execSync("echo 'NOT PROCESSING:"+oldfilename+" "+filename+"' >>log.txt");
		}

	}
	catch (e) {
		console.error("ERROR renaming",oldfilename);
	}
	finally {
		en.unshift(filename);
		en.unshift(oldfilename);
	}
	return en;
});

out = docsArr.map((ln) => {
	if (ln) {
		return ln.map((col) => {
			// strip out all tabs and newlines 
			return col.replace(/[\s\n\r]+/g,' ');
		}).join("\t");
	}
}).join("\n");
	
fs.writeFileSync("processed."+fn+'.json',JSON.stringify(docsArr, null, 1));
fs.writeFileSync("processed."+fn+'.tsv',out);



// From stack overflow
// https://stackoverflow.com/questions/1293147/javascript-code-to-parse-csv-data
//
 function CSVToArray( strData, strDelimiter ){
        // Check to see if the delimiter is defined. If not,
        // then default to comma.
        strDelimiter = (strDelimiter || ",");

        // Create a regular expression to parse the CSV values.
        var objPattern = new RegExp(
            (
                // Delimiters.
                "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

                // Quoted fields.
                "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

                // Standard fields.
                "([^\"\\" + strDelimiter + "\\r\\n]*))"
            ),
            "gi"
            );


        // Create an array to hold our data. Give the array
        // a default empty first row.
        var arrData = [[]];

        // Create an array to hold our individual pattern
        // matching groups.
        var arrMatches = null;


        // Keep looping over the regular expression matches
        // until we can no longer find a match.
        while (arrMatches = objPattern.exec( strData )){

            // Get the delimiter that was found.
            var strMatchedDelimiter = arrMatches[ 1 ];

            // Check to see if the given delimiter has a length
            // (is not the start of string) and if it matches
            // field delimiter. If id does not, then we know
            // that this delimiter is a row delimiter.
            if (
                strMatchedDelimiter.length &&
                strMatchedDelimiter !== strDelimiter
                ){

                // Since we have reached a new row of data,
                // add an empty row to our data array.
                arrData.push( [] );

            }

            var strMatchedValue;

            // Now that we have our delimiter out of the way,
            // let's check to see which kind of value we
            // captured (quoted or unquoted).
            if (arrMatches[ 2 ]){

                // We found a quoted value. When we capture
                // this value, unescape any double quotes.
                strMatchedValue = arrMatches[ 2 ].replace(
                    new RegExp( "\"\"", "g" ),
                    "\""
                    );

            } else {

                // We found a non-quoted value.
                strMatchedValue = arrMatches[ 3 ];

            }


            // Now that we have our value string, let's add
            // it to the data array.
            arrData[ arrData.length - 1 ].push( strMatchedValue );
        }

        // Return the parsed data.
        return( arrData );
    }
